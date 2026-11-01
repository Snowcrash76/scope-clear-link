-- Explicit owner-confirmed destructive deletion. Normal DELETE permissions and
-- financial/staff retention remain unchanged outside this transaction.
BEGIN;
CREATE SCHEMA IF NOT EXISTS deletion_private;
REVOKE ALL ON SCHEMA deletion_private FROM PUBLIC;
CREATE TABLE deletion_private.targets (
  transaction_id bigint NOT NULL, relation_id oid NOT NULL, row_id uuid NOT NULL,
  PRIMARY KEY(transaction_id,relation_id,row_id)
);
REVOKE ALL ON deletion_private.targets FROM PUBLIC,anon,authenticated;
CREATE TABLE public.deletion_file_cleanup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL,
  files jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deletion_file_cleanup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.deletion_file_cleanup FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.deletion_file_cleanup TO service_role;

CREATE FUNCTION public.is_confirmed_deletion(p_relation oid,p_row jsonb)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM deletion_private.targets
    WHERE transaction_id=pg_catalog.txid_current() AND relation_id=p_relation
      AND row_id::text=p_row->>'id')
$$;
REVOKE ALL ON FUNCTION public.is_confirmed_deletion(oid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_confirmed_deletion(oid,jsonb) TO authenticated,service_role;

-- Preserve each existing trigger in full; permit only rows explicitly enrolled
-- by the service-only, owner-checked RPC below. No session setting can grant it.
DO $$
DECLARE f record; definition text;
BEGIN
  FOR f IN SELECT DISTINCT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_trigger t ON t.tgfoid=p.oid
    WHERE n.nspname='public' AND NOT t.tgisinternal AND (t.tgtype & 8)=8
      AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
  LOOP
    definition:=pg_get_functiondef(f.oid);
    IF position('public.is_confirmed_deletion' IN definition)=0 THEN
      definition:=regexp_replace(definition,'\mBEGIN\M',
        'BEGIN IF TG_OP = ''DELETE'' AND public.is_confirmed_deletion(TG_RELID,to_jsonb(OLD)) THEN RETURN OLD; END IF;', 'i');
      EXECUTE definition;
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION public.owner_delete_resources(
  p_actor uuid,p_kind text,p_id uuid DEFAULT NULL,p_client_key text DEFAULT NULL,
  p_confirmation text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  roots uuid[]; root_table oid; tx bigint:=pg_catalog.txid_current();
  fk record; relation record; added integer; pass_added integer;
  remaining integer; affected integer; progress integer; total_deleted integer:=0;
  files jsonb:='[]'::jsonb; captured jsonb; cleanup_id uuid;
  wrong_scope boolean;
BEGIN
  IF p_actor IS NULL OR p_confirmation IS DISTINCT FROM 'DELETE'
    OR p_kind NOT IN ('client','quote','invoice') THEN
    RAISE EXCEPTION 'Explicit DELETE confirmation is required.' USING ERRCODE='22023';
  END IF;
  IF NOT public.platform_check_access(p_actor) OR NOT public.platform_check_business(p_actor) THEN
    RAISE EXCEPTION 'Account access is restricted.' USING ERRCODE='42501';
  END IF;
  -- Serialise destructive operations for this business, including overlapping
  -- quote/client requests. Parent row locks also serialise child FK inserts.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,83));
  IF p_kind='client' THEN
    IF p_client_key IS NULL THEN
      RAISE EXCEPTION 'A client identifier is required.' USING ERRCODE='22023';
    END IF;
    SELECT array_agg(id) INTO roots FROM (
      SELECT id FROM public.projects WHERE user_id=p_actor
        AND coalesce(nullif(lower(trim(client_email)),''),lower(trim(client_name)))=p_client_key
      ORDER BY id FOR UPDATE
    ) owned;
    root_table:='public.projects'::regclass;
  ELSIF p_kind='quote' THEN
    SELECT array_agg(q.id) INTO roots FROM public.quotes q JOIN public.projects p ON p.id=q.project_id
      WHERE q.id=p_id AND p.user_id=p_actor;
    root_table:='public.quotes'::regclass;
  ELSE
    SELECT array_agg(i.id) INTO roots FROM public.invoices i JOIN public.projects p ON p.id=i.project_id
      WHERE i.id=p_id AND p.user_id=p_actor;
    root_table:='public.invoices'::regclass;
  END IF;
  IF coalesce(cardinality(roots),0)=0 THEN
    RAISE EXCEPTION 'Record not found or access denied. Refresh before retrying.' USING ERRCODE='P0002';
  END IF;
  INSERT INTO deletion_private.targets SELECT tx,root_table,unnest(roots);
  -- Follow real FK relationships, including staff RESTRICT references during
  -- a client wipe. Standalone quote/invoice deletion follows CASCADE only:
  -- deleting a quote must not delete its job, costs or issued invoices.
  LOOP
    pass_added:=0;
    FOR fk IN
      SELECT c.conrelid AS child,c.confrelid AS parent,a.attname AS column_name
      FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid
      JOIN pg_namespace ns ON ns.oid=cl.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
      JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=c.confkey[1]
      WHERE c.contype='f' AND cardinality(c.conkey)=1 AND pa.attname='id'
        AND ns.nspname='public' AND c.conrelid<>'public.projects'::regclass
        AND (p_kind='client' OR c.confdeltype='c')
        AND EXISTS(SELECT 1 FROM pg_attribute ia WHERE ia.attrelid=c.conrelid
          AND ia.attname='id' AND ia.atttypid='uuid'::regtype)
        AND EXISTS(SELECT 1 FROM deletion_private.targets t WHERE t.transaction_id=tx AND t.relation_id=c.confrelid)
    LOOP
      EXECUTE format('INSERT INTO deletion_private.targets SELECT $1,$2,c.id FROM %s c
        JOIN deletion_private.targets t ON t.transaction_id=$1 AND t.relation_id=$3
          AND c.%I=t.row_id ON CONFLICT DO NOTHING',fk.child::regclass,fk.column_name)
        USING tx,fk.child,fk.parent;
      GET DIAGNOSTICS added=ROW_COUNT;
      pass_added:=pass_added+added;
    END LOOP;
    EXIT WHEN pass_added=0;
  END LOOP;
  -- Source links are not ownership. A corrupt/cross-job source reference must
  -- never cause another client's invoice lines or another business's records
  -- to be erased by graph traversal. Fail the entire transaction instead.
  FOR relation IN SELECT DISTINCT relation_id FROM deletion_private.targets WHERE transaction_id=tx LOOP
    EXECUTE format('SELECT coalesce(bool_or(
        (to_jsonb(r)->>''owner_id'' IS NOT NULL AND to_jsonb(r)->>''owner_id''<>$3::text)
        OR (to_jsonb(r)->>''user_id'' IS NOT NULL AND to_jsonb(r)->>''user_id''<>$3::text)
        OR ($4=''client'' AND coalesce(to_jsonb(r)->>''project_id'',to_jsonb(r)->>''job_id'') IS NOT NULL
          AND NOT (coalesce(to_jsonb(r)->>''project_id'',to_jsonb(r)->>''job_id'')::uuid=ANY($5)))
        OR (to_jsonb(r)->>''invoice_id'' IS NOT NULL AND NOT EXISTS(
          SELECT 1 FROM deletion_private.targets x WHERE x.transaction_id=$1
            AND x.relation_id=''public.invoices''::regclass AND x.row_id::text=to_jsonb(r)->>''invoice_id''))
      ),false) FROM %s r JOIN deletion_private.targets t
        ON t.transaction_id=$1 AND t.relation_id=$2 AND t.row_id=r.id',relation.relation_id::regclass)
      INTO wrong_scope USING tx,relation.relation_id,p_actor,p_kind,roots;
    IF wrong_scope THEN
      RAISE EXCEPTION 'A linked record belongs to another job or business. Nothing was deleted.' USING ERRCODE='42501';
    END IF;
  END LOOP;
  -- Lock targets before checking delivery state. Never race an invoice email
  -- already accepted for delivery or destroy its idempotency record mid-send.
  FOR relation IN SELECT DISTINCT relation_id FROM deletion_private.targets WHERE transaction_id=tx ORDER BY relation_id LOOP
    EXECUTE format('SELECT r.id FROM %s r JOIN deletion_private.targets t
      ON t.transaction_id=$1 AND t.relation_id=$2 AND t.row_id=r.id FOR UPDATE OF r',relation.relation_id::regclass)
      USING tx,relation.relation_id;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.invoices i JOIN deletion_private.targets t
      ON t.transaction_id=tx AND t.relation_id='public.invoices'::regclass AND t.row_id=i.id
      WHERE i.delivery_token IS NOT NULL) THEN
    RAISE EXCEPTION 'An invoice is being delivered. Confirm its delivery before deleting.' USING ERRCODE='55000';
  END IF;
  -- Capture privately held file references before their metadata disappears.
  IF p_kind='client' THEN
    FOR relation IN SELECT DISTINCT relation_id FROM deletion_private.targets WHERE transaction_id=tx LOOP
      EXECUTE format('SELECT coalesce(jsonb_agg(jsonb_build_object(
          ''url'',coalesce(to_jsonb(r)->>''receipt_image_url'',to_jsonb(r)->>''file_url''),
          ''bucket'',coalesce(to_jsonb(r)->>''storage_bucket'',CASE WHEN to_jsonb(r)->>''receipt_image_url'' IS NOT NULL THEN ''job-cost-receipts'' ELSE ''project-documents'' END),
          ''jobId'',coalesce(to_jsonb(r)->>''job_id'',to_jsonb(r)->>''project_id''))),''[]''::jsonb)
        FROM %s r JOIN deletion_private.targets t ON t.transaction_id=$1 AND t.relation_id=$2 AND t.row_id=r.id
        WHERE coalesce(to_jsonb(r)->>''receipt_image_url'',to_jsonb(r)->>''file_url'') IS NOT NULL',relation.relation_id::regclass)
        INTO captured USING tx,relation.relation_id;
      files:=files||captured;
    END LOOP;
    -- Break the nullable back-reference before deleting quotes. Other child
    -- dependencies are resolved by the FK-aware deletion loop below.
    UPDATE public.projects SET active_quote_id=NULL WHERE id=ANY(roots);
  END IF;
  LOOP
    progress:=0;
    SELECT count(*) INTO remaining FROM deletion_private.targets WHERE transaction_id=tx;
    EXIT WHEN remaining=0;
    FOR relation IN SELECT DISTINCT relation_id FROM deletion_private.targets WHERE transaction_id=tx ORDER BY relation_id LOOP
      BEGIN
        EXECUTE format('DELETE FROM %s r USING deletion_private.targets t
          WHERE t.transaction_id=$1 AND t.relation_id=$2 AND t.row_id=r.id',relation.relation_id::regclass)
          USING tx,relation.relation_id;
        GET DIAGNOSTICS affected=ROW_COUNT;
        total_deleted:=total_deleted+affected;
        DELETE FROM deletion_private.targets WHERE transaction_id=tx AND relation_id=relation.relation_id;
        progress:=progress+1;
      EXCEPTION WHEN foreign_key_violation THEN
        -- Roll back this table only; retry after its children. Any unresolved
        -- dependency aborts the whole RPC, never leaving a partial wipe.
        NULL;
      END;
    END LOOP;
    IF progress=0 THEN
      RAISE EXCEPTION 'Deletion is blocked by an unhandled relationship. Nothing was deleted.' USING ERRCODE='23503';
    END IF;
  END LOOP;
  IF jsonb_array_length(files)>0 THEN
    INSERT INTO public.deletion_file_cleanup(owner_id,files) VALUES(p_actor,files) RETURNING id INTO cleanup_id;
  END IF;
  RETURN jsonb_build_object('deleted',true,'kind',p_kind,'recordsDeleted',total_deleted,'cleanupId',cleanup_id);
END $$;
REVOKE ALL ON FUNCTION public.owner_delete_resources(uuid,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.owner_delete_resources(uuid,text,uuid,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
