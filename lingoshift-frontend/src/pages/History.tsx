import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import { FaTrash, FaFolderPlus } from "react-icons/fa";
import { IoIosArrowForward } from "react-icons/io";
import { useNavigate } from "react-router-dom";

import { FaFilePdf, FaFileWord } from "react-icons/fa6";

interface DocumentRecord {
  id: string;
  fileName: string;
  fileType: string;
  sourceLanguage: string;
  targetLanguage: string;
  originalPath: string;
  translatedPath: string;
  createdAt: string;
}

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: "bg-red-500/80",
  docx: "bg-amber-500/80",
  txt: "bg-slate-500/80",
};

function getBaseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB");
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function groupByDate(docs: DocumentRecord[]): Record<string, DocumentRecord[]> {
  const groups: Record<string, DocumentRecord[]> = {};
  for (const doc of docs) {
    const key = formatDateHeader(doc.createdAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(doc);
  }
  return groups;
}

function History() {
  const navigate = useNavigate();

  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [savingToProject, setSavingToProject] = useState<boolean>(false);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api
      .get("/documents/")
      .then((res) => setDocuments(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (docId: string) => {
    try {
      await api.delete(`/documents/${docId}`);
      setDocuments(documents.filter((doc) => doc.id !== docId));
    } catch (err) {
      console.error("Error deleting document:", err);
    }
  };
  const openProjectModal = async (docId: string) => {
    setSelectedDocId(docId);
    setShowProjectModal(true);
    try {
      const res = await api.get("/projects/");
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddToProject = async (projectId: string) => {
    setSavingToProject(true);
    try {
      await api.post(`/projects/${projectId}/documents`, {
        document_id: selectedDocId,
      });
      setShowProjectModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingToProject(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newProjectName.trim()) return;
    setSavingToProject(true);
    try {
      const res = await api.post("/projects/", { name: newProjectName.trim() });
      await api.post(`/projects/${res.data.id}/documents`, {
        document_id: selectedDocId,
      });
      setNewProjectName("");
      setShowProjectModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingToProject(false);
    }
  };

  const grouped = groupByDate(documents);
  const dateKeys = Object.keys(grouped).sort(
    (a, b) =>
      new Date(b.split("/").reverse().join("-")).getTime() -
      new Date(a.split("/").reverse().join("-")).getTime(),
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-7xl h-[85vh] bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-6 overflow-y-auto">
          <h2 className="text-white text-xl font-semibold mb-6"></h2>

          {loading && <p className="text-white/50 text-sm">Loading...</p>}

          {!loading && documents.length === 0 && (
            <p className="text-white/40 text-sm">
              No translated documents yet.
            </p>
          )}

          {dateKeys.map((dateKey) => (
            <div key={dateKey} className="mb-8">
              <h3 className="text-white/60 text-sm font-medium mb-3">
                {dateKey}
              </h3>
              <div className="grid grid-cols-5 gap-4">
                {grouped[dateKey].map((doc) => {
                  const originalName = getBaseName(doc.originalPath);
                  const translatedName = getBaseName(doc.translatedPath);
                  const badgeColor =
                    FILE_TYPE_COLORS[doc.fileType] || "bg-slate-500/80";

                  return (
                    <div
                      key={doc.id}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="relative bg-white/10 border border-white/20 rounded-xl p-4 flex flex-col gap-3 hover:bg-white/20 hover:shadow-lg transition"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                        title="Delete"
                        className="absolute bottom-2 left-2 w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition z-10"
                      >
                        <FaTrash className="text-red-400 text-xs" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openProjectModal(doc.id);
                        }}
                        title="Add to project"
                        className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition z-10"
                      >
                        <FaFolderPlus className="text-white text-xs" />
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 flex flex-col items-center gap-1 group">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold">
                            {doc.fileType.toUpperCase() === "DOCX" ? (
                              <FaFileWord
                                className="text-blue-400 text-sm"
                                size={30}
                              />
                            ) : doc.fileType.toUpperCase() === "PDF" ? (
                              <FaFilePdf
                                className="text-red-400 text-sm"
                                size={30}
                              />
                            ) : (
                              <span>TXT</span>
                            )}
                          </div>
                          <span className="text-white/70 text-[10px] text-center truncate w-full group-hover:text-white transition">
                            {originalName}
                          </span>
                          <span className="text-white/30 text-[9px]">
                            Original
                          </span>
                        </div>

                        <span className="text-white/30 text-lg">
                          <IoIosArrowForward />
                        </span>

                        <div className="flex-1 flex flex-col items-center gap-1 group">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold">
                            {doc.fileType.toUpperCase() === "DOCX" ? (
                              <FaFileWord
                                className="text-blue-400 text-sm"
                                size={30}
                              />
                            ) : doc.fileType.toUpperCase() === "PDF" ? (
                              <FaFilePdf
                                className="text-red-400 text-sm"
                                size={30}
                              />
                            ) : (
                              <span>TXT</span>
                            )}
                          </div>
                          <span className="text-white text-[10px] text-center truncate w-full group-hover:underline transition">
                            {translatedName}
                          </span>
                          <span className="text-white/30 text-[9px]">
                            {doc.targetLanguage}
                          </span>
                        </div>
                      </div>

                      <span className="text-white/40 text-[10px] text-center">
                        {formatTime(doc.createdAt)}
                      </span>

                      {showProjectModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                          <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-white font-medium">
                                Save to Project
                              </h3>
                              <button
                                onClick={() => setShowProjectModal(false)}
                                className="text-white/60 hover:text-white transition text-sm"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="max-h-60 overflow-y-auto flex flex-col gap-2 mb-4">
                              {projects.length === 0 && (
                                <p className="text-white/40 text-sm">
                                  No projects yet.
                                </p>
                              )}
                              {projects.map((project) => (
                                <button
                                  key={project.id}
                                  onClick={() => handleAddToProject(project.id)}
                                  disabled={savingToProject}
                                  className="text-left px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition disabled:opacity-50"
                                >
                                  {project.name}
                                </button>
                              ))}
                            </div>

                            <div className="border-t border-white/20 pt-4 flex gap-2">
                              <input
                                type="text"
                                placeholder="New project name"
                                value={newProjectName}
                                onChange={(e) =>
                                  setNewProjectName(e.target.value)
                                }
                                className="flex-1 bg-white/20 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/50 text-sm outline-none focus:ring-2 focus:ring-white/30"
                              />
                              <button
                                onClick={handleCreateAndAdd}
                                disabled={
                                  savingToProject || !newProjectName.trim()
                                }
                                className="px-4 py-2 rounded-lg bg-white text-slate-900 font-medium text-sm hover:bg-white/90 transition disabled:opacity-50"
                              >
                                Create
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default History;
