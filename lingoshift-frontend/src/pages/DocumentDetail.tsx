import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import DocxPreview from "../components/DocxPreview";
import api from "../api/axios";
import { FaArrowLeft, FaFileWord, FaFilePdf, FaFileDownload } from "react-icons/fa";

interface DocumentData {
  id: string;
  fileName: string;
  fileType: string;
  targetLanguage: string;
  originalPath: string;
  translatedPath: string;
  createdAt: string;
}

function getBaseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB");
}

function DocumentDetail() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api
      .get(`/documents/${documentId}`)
      .then((res) => setDoc(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [documentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/50 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!doc) return null;

  const originalUrl = `http://localhost:8000/files/${getBaseName(doc.originalPath)}`;
  const translatedUrl = `http://localhost:8000/files/${getBaseName(doc.translatedPath)}`;
  const isDocx = doc.fileType.toUpperCase() === "DOCX";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[1800px] h-[92vh] bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-8 flex flex-col gap-6">

          {/* Header: back button + document info + icon */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="text-[#9f7c55] hover:text-[#c19a6b] transition"
            >
              <FaArrowLeft size={18} />
            </button>

            {isDocx ? (
              <FaFileWord className="text-blue-400" size={28} />
            ) : (
              <FaFilePdf className="text-red-400" size={28} />
            )}

            <div>
              <h2 className="text-white text-lg font-semibold">{getBaseName(doc.originalPath)}</h2>
              <p className="text-white/40 text-xs">
                {doc.fileType.toUpperCase()} · Translated to {doc.targetLanguage} · {formatDate(doc.createdAt)}
              </p>
            </div>
          </div>

          {/* Side-by-side panels, bigger */}
          <div className="flex-1 flex gap-16 min-h-0">
            <div className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Original</h3>
                <a
                  href={originalUrl}
                  download
                  title="Download original"
                  className="text-white/70 hover:text-white transition"
                >
                  <FaFileDownload size={18} />
                </a>
              </div>
              <div className="flex-1 w-full rounded-lg overflow-hidden">
                {doc.fileType === "pdf" ? (
                  <iframe src={originalUrl} title="Original" className="w-full h-full rounded-lg bg-white" />
                ) : (
                  <DocxPreview url={originalUrl} />
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Translated</h3>
                <a
                  href={translatedUrl}
                  download
                  title="Download translated"
                  className="text-white/70 hover:text-white transition"
                >
                  <FaFileDownload size={18} />
                </a>
              </div>
              <div className="flex-1 w-full rounded-lg overflow-hidden">
                {doc.fileType === "pdf" ? (
                  <iframe src={translatedUrl} title="Translated" className="w-full h-full rounded-lg bg-white" />
                ) : (
                  <DocxPreview url={translatedUrl} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentDetail;