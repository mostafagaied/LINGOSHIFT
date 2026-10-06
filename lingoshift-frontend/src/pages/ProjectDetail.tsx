import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import { FaTrash, FaArrowLeft } from "react-icons/fa";
import { IoIosArrowForward } from "react-icons/io";
import { FaFilePdf, FaFileWord } from "react-icons/fa6";

interface DocumentRecord {
  id: string;
  fileName: string;
  fileType: string;
  targetLanguage: string;
  originalPath: string;
  translatedPath: string;
  createdAt: string;
}

interface ProjectDetailData {
  id: string;
  name: string;
  documents: DocumentRecord[];
}

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: "bg-red-500/80",
  docx: "bg-amber-500/80",
  txt: "bg-slate-500/80",
};

function getBaseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const handleRemoveFromProject = async (docId: string) => {
    try {
      await api.delete(`/projects/${projectId}/documents/${docId}`);
      setProject((prev) =>
        prev
          ? { ...prev, documents: prev.documents.filter((d) => d.id !== docId) }
          : prev,
      );
    } catch (err) {
      console.error(err);
    }
  };
  useEffect(() => {
    api
      .get(`/projects/${projectId}`)
      .then((res) => setProject(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-7xl h-[85vh] bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-6 overflow-y-auto">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate("/projects")}
              className="text-[#9f7c55] hover:text-[#c19a6b] transition"
            >
              <FaArrowLeft />
            </button>
            <h2 className="text-white text-xl font-semibold">
              {loading ? "Loading..." : project?.name}
            </h2>
          </div>

          {!loading && project && project.documents.length === 0 && (
            <p className="text-white/40 text-sm">
              No documents in this project yet.
            </p>
          )}

          <div className="grid grid-cols-5 gap-4">
            {project?.documents.map((doc) => {
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
                    onClick={() => handleRemoveFromProject(doc.id)}
                    title="Remove from project"
                    className="absolute bottom-2 left-2 w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition z-10"
                  >
                    <FaTrash className="text-red-400 text-xs" />
                  </button>
                  <div className="flex items-center gap-3">
                    <a
                     
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex flex-col items-center gap-1 group"
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold `}
                      >
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
                      <span className="text-white/30 text-[9px]">Original</span>
                    </a>

                    <span className="text-white/30 text-lg">
                      <IoIosArrowForward />
                    </span>

                    <a
                      
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex flex-col items-center gap-1 group"
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold `}
                      >
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
                    </a>
                  </div>

                  <span className="text-white/40 text-[10px] text-center">
                    {formatTime(doc.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectDetail;
