"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2, Upload as UploadIcon } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { EmptyState } from "@/components/empty-state";
import { FileProcessingStatus } from "@/components/file-processing-status";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fileSize, formatDate } from "@/lib/format";
import { ACCEPTED_FILE_TYPES, uploadWorkspaceFile } from "@/lib/upload-file";
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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    const supabase = createSupabaseBrowserClient();
    let query = supabase.from("files").select("*").order("created_at", { ascending: false });
    if (projectFilter) query = query.eq("project_id", projectFilter);
    const [filesResult, projectsResult] = await Promise.all([query, supabase.from("projects").select("*").order("name")]);
    setFiles((filesResult.data as WorkspaceFile[]) || []);
    setProjects((projectsResult.data as Project[]) || []);
  }

  useEffect(() => {
    setProjectId(projectFilter || "");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  async function deleteFile(file: WorkspaceFile) {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    setDeletingId(file.id);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: storageError } = await supabase.storage.from("workspace-files").remove([file.storage_path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await supabase.from("files").delete().eq("id", file.id);
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
      await uploadWorkspaceFile(file, {
        projectId: projectId || null,
        onProgress: setUploadProgress,
        onProcessing: () => setMessage("Upload complete. Extracting text…")
      });
      setMessage("File uploaded and processed.");
      setFile(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Files" eyebrow="Workspace" />
      <form onSubmit={upload} className="panel grid gap-3 p-5 lg:grid-cols-[1fr_240px_auto]">
        <label className="flex min-h-12 items-center rounded-full border border-dashed border-[var(--border-strong)] bg-white/70 px-5 text-sm font-bold text-[var(--muted-strong)]">
          <input
            className="sr-only"
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          {file ? file.name : "Choose PDF, DOCX, TXT, Markdown, or image"}
        </label>
        <select aria-label="Project" className="input-premium px-5" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">No project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <button type="submit" className="btn-primary" disabled={!file || uploading}>
          <UploadIcon size={18} />
          {uploading ? (uploadProgress > 0 && uploadProgress < 100 ? `${uploadProgress}%` : "Processing") : "Upload"}
        </button>
      </form>
      {message ? <p className="text-sm font-bold text-[var(--muted-strong)]">{message}</p> : null}

      {files.length ? (
        <section className="panel overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Status</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/files/${item.id}`} className="font-extrabold hover:underline">
                      {item.name}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">{item.mime_type || "Unknown type"}</p>
                  </td>
                  <td>{fileSize(item.size_bytes)}</td>
                  <td><FileProcessingStatus status={item.extraction_status} /></td>
                  <td>{formatDate(item.created_at)}</td>
                  <td>
                    <button type="button" onClick={() => deleteFile(item)} disabled={deletingId === item.id} title="Delete file" className="text-[var(--muted)] hover:text-[var(--critical)]">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <EmptyState title="No files uploaded" description="Upload source material to make it available for project-aware chat and flashcard generation." />
      )}
    </div>
  );
}
