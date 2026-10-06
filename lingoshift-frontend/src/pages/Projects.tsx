import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import { FaTrash, FaPen } from "react-icons/fa";
import { FaFolder } from "react-icons/fa6";
interface ProjectRecord {
  id: string;
  name: string;
  documentCount: number;
  updatedAt: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB");
}

function Projects() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newName, setNewName] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);
  const navigate = useNavigate();
  const [renamingId, setRenamingId] = useState<string>("");
  const [renameValue, setRenameValue] = useState<string>("");
  const handleDeleteProject = async (
    e: React.MouseEvent,
    projectId: string,
  ) => {
    e.stopPropagation();
    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error(err);
    }
  };

  const startRename = (e: React.MouseEvent, project: ProjectRecord) => {
    e.stopPropagation();
    setRenamingId(project.id);
    setRenameValue(project.name);
  };

  const submitRename = async (e: React.FormEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.patch(`/projects/${projectId}`, { name: renameValue.trim() });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, name: renameValue.trim() } : p,
        ),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setRenamingId("");
    }
  };
  const loadProjects = () => {
    api
      .get("/projects/")
      .then((res) => setProjects(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post("/projects/", { name: newName.trim() });
      setNewName("");
      loadProjects();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-7xl h-[85vh] bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white text-xl font-semibold"></h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New project name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/50 text-sm outline-none focus:ring-2 focus:ring-white/30"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-4 py-1.5 rounded-lg bg-white text-slate-900 font-medium text-sm hover:bg-white/90 transition disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>

          {loading && <p className="text-white/50 text-sm">Loading...</p>}

          {!loading && projects.length === 0 && (
            <p className="text-white/40 text-sm">
              No projects yet. Create one above.
            </p>
          )}

          <div className="grid grid-cols-4 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() =>
                  renamingId !== project.id &&
                  navigate(`/projects/${project.id}`)
                }
                className="relative bg-white/10 border border-white/20 rounded-xl p-4 flex flex-col gap-2 hover:bg-white/20 hover:shadow-lg transition cursor-pointer"
              >
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={(e) => startRename(e, project)}
                    title="Rename"
                    className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition"
                  >
                    <FaPen className="text-white text-[10px]" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    title="Delete"
                    className="w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition"
                  >
                    <FaTrash className="text-red-400 text-[10px]" />
                  </button>
                </div>

                {renamingId === project.id ? (
                  <form
                    onSubmit={(e) => submitRename(e, project.id)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={(e) =>
                        submitRename(
                          e as unknown as React.FormEvent,
                          project.id,
                        )
                      }
                      className="w-full bg-white/20 border border-white/30 rounded px-2 py-1 text-white text-sm outline-none"
                    />
                  </form>
                ) : (
                  <h3 className="text-white font-medium truncate pr-14 flex items-center gap-2">
                    <FaFolder size={20} color="#9f7c55" />
                    {project.name}
                  </h3>
                )}

                <p className="text-white/50 text-xs">
                  {project.documentCount} document(s)
                </p>
                <p className="text-white/30 text-xs">
                  Updated {formatDate(project.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Projects;
