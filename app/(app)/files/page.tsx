"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, FolderOpen, Plus, Search, Trash2, Upload as UploadIcon } from "lucide-react";
import { Upload as TusUpload } from "tus-js-client";
import { WorkspaceHeader } from "@/components/workspace-header";
import { FileProcessingStatus } from "@/components/file-processing-status";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fileSize, formatDate } from "@/lib/format";
import { removeEmDashes } from "@/lib/text";
import type { Project, WorkspaceFile } from "@/lib/types";

export default function FilesPage() {
  return (
    <Suspense>
      <FilesContent />
    </Suspense>
  );
}

function FilesContent() {
  const searchParams = useSearchParams();
  const projectFilter = searchParams.get("project");
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(projectFilter || "");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    const supabase = createSupabaseBrowserClient();
    let query = supabase.from("files").select("*").order("created_at", { ascending: false });
    if (projectFilter) query = query.eq("project_id", projectFilter);
    const [filesResult, projectsResult] = await Promise.all([
      query,
      supabase.from("projects").select("*").order("name")
    ]);
    setFiles((filesResult.data as WorkspaceFile[]) || []);
    setProjects((projectsResult.data as Project[]) || []);
  }

  useEffect(() => {
    setProjectId(projectFilter || "");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  async function deleteFile(item: WorkspaceFile) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setDeletingId(item.id);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: storageError } = await supabase.storage.from("workspace-files").remove([item.storage_path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await supabase.from("files").delete().eq("id", item.id);
      if (deleteError) throw deleteError;
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete the file.");
    } finally {
      setDeletingId(null);
    }
  }

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setMessage("");
    try {
      const metadata = {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        projectId: projectId || null
      };
      const signResponse = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata)
      });
      const signed = await signResponse.json().catch(() => ({}));
      if (!signResponse.ok || !signed.storagePath || !signed.token) {
        throw new Error(signed.error || "Could not prepare the upload.");
      }

      await uploadFileResumable(file, signed.storagePath, signed.token, setUploadProgress);
      setMessage("Upload complete. Extracting text for grounded recall...");

      const response = await fetch("/api/files/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...metadata, storagePath: signed.storagePath })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "File processing failed.");
      setMessage("File uploaded and processed.");
      setFile(null);
      await load();
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-5 py-8 sm:px-8">
      <WorkspaceHeader title="Files & Documents" eyebrow="Workspace Materials" />

      {/* Upload Dropzone Container */}
      <form onSubmit={upload} className="panel p-6 bg-white space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <UploadIcon size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text)]">Grounding Source Upload</h2>
              <p className="text-xs text-[var(--muted)]">Upload PDFs, DOCX, Markdown, or TXT documents</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
          <label className="flex min-h-[44px] cursor-pointer items-center rounded-xl border border-dashed border-[var(--border-strong)] bg-slate-50/70 px-4 text-xs font-medium text-[var(--muted-strong)] transition hover:bg-white hover:border-slate-900">
            <input
              className="sr-only"
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <FileText size={15} className="mr-2 text-[var(--muted)]" />
            <span className="truncate">{file ? file.name : "Select document (.pdf, .docx, .txt, .md)"}</span>
          </label>

          <select
            aria-label="Project context"
            className="input-enterprise"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">No Project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="btn-primary"
            disabled={!file || uploading}
          >
            <UploadIcon size={15} />
            <span>
              {uploading
                ? uploadProgress > 0 && uploadProgress < 100
                  ? `${uploadProgress}%`
                  : "Processing..."
                : "Upload"}
            </span>
          </button>
        </div>

        {uploading && uploadProgress > 0 && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-slate-900 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </form>

      {message && (
        <div className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs">
          {message}
        </div>
      )}

      {/* Files Table Section */}
      <section className="panel overflow-hidden bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Uploaded Materials
            </span>
            <span className="badge badge-subtle text-[10px]">{files.length}</span>
          </div>

          <div className="flex items-center rounded-lg border border-[var(--border)] bg-slate-50 px-2.5 py-1 text-xs text-[var(--muted)]">
            <Search size={13} className="mr-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter files..."
              className="w-36 bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--muted)] sm:w-48"
            />
          </div>
        </div>

        {filteredFiles.length === 0 ? (
          <div className="py-12 text-center">
            <FileText size={32} className="mx-auto text-slate-300" />
            <h3 className="mt-3 text-sm font-bold text-[var(--text)]">No files found</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {search ? "No files match your search query." : "Upload documents above to make them searchable by AI."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document Name</th>
                  <th>Size</th>
                  <th>Grounding Status</th>
                  <th>Date Uploaded</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        href={`/files/${item.id}`}
                        className="font-semibold text-[var(--text)] hover:underline"
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">{item.mime_type || "Document"}</p>
                    </td>
                    <td>{fileSize(item.size_bytes)}</td>
                    <td>
                      <FileProcessingStatus status={item.extraction_status} />
                    </td>
                    <td>{formatDate(item.created_at)}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => deleteFile(item)}
                        disabled={deletingId === item.id}
                        title="Delete file"
                        className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function uploadFileResumable(
  file: File,
  storagePath: string,
  token: string,
  onProgress: (progress: number) => void
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return Promise.reject(new Error("Storage is not configured."));
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

  return new Promise<void>((resolve, reject) => {
    const upload = new TusUpload(file, {
      endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable/sign`,
      headers: { "x-signature": token },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "workspace-files",
        objectName: storagePath,
        contentType: file.type || "application/octet-stream"
      },
      onError(error) {
        reject(error);
      },
      onProgress(bytesUploaded, bytesTotal) {
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess() {
        resolve();
      }
    });

    upload
      .findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      })
      .catch(reject);
  });
}
