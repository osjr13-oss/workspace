"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Upload } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { EmptyState } from "@/components/empty-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fileSize, formatDate } from "@/lib/format";
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

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setMessage("");
    const form = new FormData();
    form.append("file", file);
    if (projectId) form.append("projectId", projectId);
    const response = await fetch("/api/files/upload", { method: "POST", body: form });
    const payload = await response.json();
    setMessage(response.ok ? "File uploaded and processed." : payload.error || "Upload failed.");
    setFile(null);
    await load();
    setUploading(false);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Files" eyebrow="Workspace" />
      <form onSubmit={upload} className="panel grid gap-3 p-5 lg:grid-cols-[1fr_240px_auto]">
        <label className="flex min-h-12 items-center rounded-full border border-dashed border-[var(--border-strong)] bg-white/70 px-5 text-sm font-bold text-[var(--muted-strong)]">
          <input
            className="sr-only"
            type="file"
            accept=".pdf,.docx,.txt,.md,.markdown,image/*"
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
          <Upload size={18} />
          {uploading ? "Uploading" : "Upload"}
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
              </tr>
            </thead>
            <tbody>
              {files.map((item) => (
                <tr key={item.id}>
                  <td>
                    <p className="font-extrabold">{item.name}</p>
                    <p className="text-xs text-[var(--muted)]">{item.mime_type || "Unknown type"}</p>
                  </td>
                  <td>{fileSize(item.size_bytes)}</td>
                  <td><span className="status-pill">{item.extraction_status}</span></td>
                  <td>{formatDate(item.created_at)}</td>
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
