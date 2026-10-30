import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DocumentThumbnail,
  filterProjectDocuments,
  groupProjectDocument,
  storagePathForDocument,
  type ProjectDocumentItem,
} from "../src/components/documentThumbnails";

const doc = (overrides: Partial<ProjectDocumentItem> = {}): ProjectDocumentItem => ({
  id: "doc-1",
  file_name: "site-photo.jpg",
  display_name: "Site photo",
  file_url: "owner/project/site-photo.jpg",
  file_type: "image/jpeg",
  file_size: 4096,
  created_at: "2026-05-01T10:00:00.000Z",
  purpose: "client_document",
  ...overrides,
});

test("document grouping prioritizes photo MIME while preserving explicit purposes", () => {
  assert.equal(groupProjectDocument(doc()), "Photos");
  assert.equal(groupProjectDocument(doc({ file_type: "application/pdf", purpose: "site_plan" })), "Site plans & drawings");
  assert.equal(groupProjectDocument(doc({ file_type: "image/jpeg", purpose: "inspection_report" })), "Reports & certificates");
  assert.equal(groupProjectDocument(doc({ file_type: "application/pdf", purpose: "client_upload" })), "Client documents");
  // A generic client_document purpose does not prove who uploaded a trade document.
  assert.equal(groupProjectDocument(doc({ file_type: "application/pdf", purpose: "client_document" })), "Other");
});

test("document type and text filters retain image uploads independent of their purpose", () => {
  const photo = doc({ id: "photo", display_name: "Kitchen progress", purpose: "client_document" });
  const pdf = doc({ id: "pdf", file_name: "scope.pdf", display_name: "Scope", file_type: "application/pdf" });
  assert.deepEqual(filterProjectDocuments([photo, pdf], "", "image").map((item) => item.id), ["photo"]);
  assert.deepEqual(filterProjectDocuments([photo, pdf], "kitchen", "all").map((item) => item.id), ["photo"]);
  assert.deepEqual(filterProjectDocuments([photo, pdf], "", "pdf").map((item) => item.id), ["pdf"]);
});

test("thumbnail requests are visibility-gated and use private signed URLs only", () => {
  const markup = renderToStaticMarkup(<DocumentThumbnail document={doc()} />);
  const source = readFileSync("src/components/documentThumbnails.tsx", "utf8");
  assert.match(markup, /aria-label="Image thumbnail for Site photo"/);
  assert.match(markup, /Loading thumbnail for Site photo/);
  assert.doesNotMatch(markup, /src=/);
  assert.match(source, /new IntersectionObserver/);
  assert.match(source, /if \(!visible \|\| !isPreviewable \|\| signedUrl \|\| failed\) return/);
  assert.match(source, /\.createSignedUrl\(storagePathForDocument\(document\.file_url\), 300\)/);
  assert.doesNotMatch(source, /getPublicUrl/);
  assert.equal(
    storagePathForDocument("https://private.example/storage/v1/object/sign/project-documents/owner/file.jpg?token=abc"),
    "owner/file.jpg",
  );
});

test("image and PDF thumbnail labels are descriptive and PDF iframe cannot take focus", () => {
  const source = readFileSync("src/components/documentThumbnails.tsx", "utf8");
  assert.match(source, /alt=\{`Preview thumbnail of \$\{displayName\}`\}/);
  assert.match(source, /title=\{`First page PDF thumbnail of \$\{displayName\}`\}/);
  assert.match(source, /aria-label=\{`First page preview of \$\{displayName\}`\}/);
  assert.match(source, /tabIndex=\{-1\}/);
});
