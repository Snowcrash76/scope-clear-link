import { supabase } from '@/integrations/supabase/client';
import { clientAccessHeaders, isClientPage } from './clientAccess';
export async function uploadClientImage(file:File,bucket:string) {
  if(bucket!=='scope-images'||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Choose a JPG, PNG or WebP image under 10 MB.');
  const response=await fetch('/api/client/images/upload-url',{method:'POST',headers:{'Content-Type':'application/json',...clientAccessHeaders()},body:JSON.stringify({file_type:file.type,file_size:file.size})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Unable to prepare image upload.');
  const {error}=await supabase.storage.from(bucket).uploadToSignedUrl(data.path,data.token,file,{contentType:file.type});
  if(error)throw new Error('Unable to upload image.');
  return data.url as string;
}
export function clientImagePreview(value:string|undefined,bucket:string) {
  if(!value||!isClientPage()||value.startsWith('/api/client/'))return value;
  const path=value.includes(`/storage/v1/object/`)?decodeURIComponent(value.split(`/${bucket}/`)[1]?.split('?')[0]||''):value;
  const headers=clientAccessHeaders(),query=new URLSearchParams({path});
  if(headers['X-Client-Project-Token'])query.set('access',headers['X-Client-Project-Token']);
  else if(headers['X-Client-Quote-Token'])query.set('quote_access',headers['X-Client-Quote-Token']);
  return `/api/client/images/preview?${query}`;
}
