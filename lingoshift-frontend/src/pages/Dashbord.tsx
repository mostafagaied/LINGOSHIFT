import { useState, useRef } from "react";
import Navbar from "../components/Navbar";
import DocxPreview from "../components/DocxPreview";
import api from "../api/axios";
import { FaFileDownload } from "react-icons/fa";
import { FaFilePdf, FaFileWord } from "react-icons/fa6";
import { FaTrash, FaRobot, FaRedoAlt, FaFolderPlus } from "react-icons/fa";
import { RiArrowGoBackFill } from "react-icons/ri";
import { FaUpload } from "react-icons/fa6";
import { AiOutlineSend } from "react-icons/ai";
import { BsTranslate } from "react-icons/bs";
import useTypewriter from "../hooks/useTypewriter";
import useTextSelectionPopup from "../hooks/useTextSelectionPopup";
import { GiConfirmed } from "react-icons/gi";
const LANGUAGES = [
  "English",
  "French",
  "Arabic",
  "Spanish",
  "German",
  "Italian",
];
const RTL_LANGUAGES = ["Arabic", "Hebrew", "Persian", "Farsi", "Urdu"];

function Dashboard() {
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const [go, setGo] = useState(false);
  const [generatedDocId, setGeneratedDocId] = useState<string>("");
  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [savingToProject, setSavingToProject] = useState<boolean>(false);
  const [langOpen, setLangOpen] = useState(false);
  const [inputText, setInputText] = useState<string>("");
  const [outputText, setOutputText] = useState<string>("");
  const [targetLang, setTargetLang] = useState<string>("English");
  const [instruction, setInstruction] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileType, setFileType] = useState<"pdf" | "docx" | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [threadId, setThreadId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const [hasFile, setHasFile] = useState<boolean>(false);
  const [generatedFileUrl, setGeneratedFileUrl] = useState<string>("");
  const [generating, setGenerating] = useState<boolean>(false);

  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const translatedBoxRef = useRef<HTMLDivElement>(null);

  const { displayedText, isStreaming } = useTypewriter(outputText, 35);
  const { popup, closePopup } = useTextSelectionPopup(translatedBoxRef);

  const isRtl = RTL_LANGUAGES.includes(targetLang);

  const processFile = (fileToProcess: File) => {
    setFileName(fileToProcess.name);
    setUploadedFile(fileToProcess);

    const ext = fileToProcess.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      setFileType("pdf");
      setFilePreviewUrl(URL.createObjectURL(fileToProcess));
    } else if (ext === "docx") {
      setFileType("docx");
      setFilePreviewUrl("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (threadId) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (threadId) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      console.warn("Unsupported file type dropped");
      return;
    }

    processFile(file);
  };

  const clearFile = () => {
    setFileName("");
    setFileType(null);
    setFilePreviewUrl("");
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    if (!inputText.trim() && !uploadedFile) return;
    setLoading(true);

    try {
      let res;

      if (threadId) {
        res = await api.post("/translate/instruction", {
          thread_id: threadId,
          instruction: instruction,
        });
      } else {
        const formData = new FormData();
        formData.append("target_lang", targetLang);
        formData.append("instruction", instruction);

        if (uploadedFile) {
          formData.append("file", uploadedFile);
        } else {
          formData.append("text", inputText);
        }

        res = await api.post("/translate/start", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setOutputText(res.data.translated_text);
      setThreadId(res.data.thread_id);
      setHasFile(res.data.has_file);
      setInstruction("");
    } catch (err) {
      console.error(err);
      setOutputText("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFile = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/translate/approve", {
        thread_id: threadId,
        target_lang: targetLang,
      });
      const generatedName = res.data.output_path.split(/[\\/]/).pop();
      setGeneratedFileUrl(`http://localhost:8000/files/${generatedName}`);
      setGeneratedDocId(res.data.document_id);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const openProjectModal = async () => {
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
        document_id: generatedDocId,
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
        document_id: generatedDocId,
      });
      setNewProjectName("");
      setShowProjectModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingToProject(false);
    }
  };

  const startNewTranslation = () => {
    setInputText("");
    setOutputText("");
    setInstruction("");
    setThreadId("");
    setHasFile(false);
    setGeneratedFileUrl("");
    setGeneratedDocId("");
    clearFile();
  };

  const insertSelectionIntoInstruction = () => {
    const quoted = `"${popup.text}"`;
    const newValue = instruction ? `${instruction} ${quoted}` : quoted;

    setInstruction(newValue);
    closePopup();
    window.getSelection()?.removeAllRanges();

    // Wait for React to apply the new value, then focus + move cursor to the end
    requestAnimationFrame(() => {
      const el = instructionRef.current;
      if (el) {
        el.focus();
        const len = newValue.length;
        el.setSelectionRange(len, len);

        // Also re-trigger the auto-resize logic since we set the value programmatically
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[1700px] h-[90vh] bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-8 flex flex-col gap-6">
          <div className="flex-1 flex gap-24 min-h-0 relative">
            {/* Left panel: text input OR document preview */}
            <div className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-medium">Original</h3>
                  {fileName && fileType && (
                    <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-lg px-2 py-1">
                      {fileType === "pdf" ? (
                        <FaFilePdf className="text-red-400 text-sm" />
                      ) : (
                        <FaFileWord className="text-blue-400 text-sm" />
                      )}
                      <span className="text-white/80 text-xs truncate max-w-[140px]">
                        {fileName}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {fileName && (
                    <button
                      onClick={clearFile}
                      className="px-3 py-1 rounded-lg bg-white/20 text-white text-xs hover:bg-white/30 transition flex items-center gap-1.5"
                    >
                      <FaTrash className="text-red-400 text-xs" />
                      <span className="text-white/80 text-xs truncate max-w-[140px]">
                        Remove file
                      </span>
                    </button>
                  )}
                  <label className="cursor-pointer px-3 py-1 rounded-lg bg-white/20 text-white text-xs hover:bg-white/30 transition flex items-center gap-1.5">
                    <FaUpload className="text-green-400 text-xs" />
                    <span className="text-white/80 text-xs truncate max-w-[140px]">
                      Upload file
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={!!threadId}
                    />
                  </label>
                </div>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex-1 w-full rounded-lg overflow-hidden relative transition ${
                  isDragging ? "ring-2 ring-white/60 bg-white/10" : ""
                }`}
              >
                {isDragging && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-lg pointer-events-none">
                    <p className="text-white text-sm font-medium">
                      Drop your PDF or DOCX here
                    </p>
                  </div>
                )}

                {!fileName && (
                  <textarea
                    className="w-full h-full bg-white/20 border border-white/20 rounded-lg p-3 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-white/30 resize-none"
                    placeholder="Paste your text here, or upload a PDF/DOCX above..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={!!threadId}
                  />
                )}

                {fileName && fileType === "pdf" && (
                  <iframe
                    src={filePreviewUrl}
                    title="PDF preview"
                    className="w-full h-full rounded-lg border border-white/20 bg-white"
                  />
                )}

                {fileName && fileType === "docx" && uploadedFile && (
                  <DocxPreview file={uploadedFile} />
                )}
              </div>
            </div>

            {/* Circular "New translation" button */}
            {threadId && (
              <button
                onClick={startNewTranslation}
                title="Start new translation"
                className={`absolute left-1/2 -translate-x-1/2 z-10 w-12 h-12 rounded-full bg-white/20 border border-white/30 text-white shadow-xl flex items-center justify-center text-lg hover:bg-white/30 transition ${
                  outputText && hasFile && !generatedFileUrl
                    ? "top-[calc(50%-40px)]"
                    : "top-1/2 -translate-y-1/2"
                }`}
              >
                <FaRedoAlt size={25} />
              </button>
            )}

            {/* Circular generate/approve button */}
            {outputText && hasFile && !generatedFileUrl && (
              <button
                onClick={handleGenerateFile}
                disabled={generating}
                title="Generate translated document"
                className="absolute left-1/2 top-[calc(50%+40px)] -translate-x-1/2 z-10 w-12 h-12 rounded-full bg-red/20 border border-red/30 text-red shadow-xl flex items-center justify-center text-lg hover:bg-transparent hover:border-green-100 hover:text-white hover:bg-green-100/40 "
              >
                {generating ? "..." : <GiConfirmed size={30} color="green" />}
              </button>
            )}
            {generatedFileUrl && generatedDocId && (
              <button
                onClick={openProjectModal}
                title="Save to project"
                className="absolute left-1/2 top-[calc(50%+40px)] -translate-x-1/2 z-10 w-12 h-12 rounded-full bg-white/20 border border-white/30 text-white shadow-xl flex items-center justify-center text-lg hover:bg-white/30 transition"
              >
                <FaFolderPlus />
              </button>
            )}

            {/* Right panel: translated output OR generated file */}
            <div className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-xl p-5 flex flex-col">
              <div className="flex items-center mb-3 gap-3">
                <h3 className="text-white font-medium whitespace-nowrap">
                  Translate to
                </h3>

                <div className="relative">
                  <button
                    type="button"
                    disabled={!!threadId}
                    onClick={() => setLangOpen(!langOpen)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !langOpen) {
                        handleSend();
                      }
                    }}
                    className="w-full bg-[#4f7773] text-white text-sm rounded-lg px-3 py-1.5 outline-none
               border border-white/20
               hover:bg-[#5b837f]
               focus:ring-2 focus:ring-[#c19a6b]/50
               transition-all duration-200
               disabled:opacity-50
               flex items-center justify-between gap-2"
                  >
                    <span>{targetLang}</span>

                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${
                        langOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {langOpen && (
                    <div
                      className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg
                    bg-[#315f5b] border border-white/20
                    shadow-xl shadow-black/20"
                    >
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            setTargetLang(lang);
                            setLangOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm
                      transition-all duration-150
                      ${
                        targetLang === lang
                          ? "bg-[#9f7c55] text-white"
                          : "text-white hover:bg-[#c19a6b] hover:text-white"
                      }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="ml-auto px-4 py-2 rounded-lg bg-[#9f7c55] text-white font-medium text-xs hover:bg-[#c19a6b] hover:shadow-lg transition-all duration-200 disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
                >
                  {loading ? (
                    "..."
                  ) : (
                    <>
                      Translate
                      <BsTranslate size={16} />
                    </>
                  )}
                </button>
              </div>

              <div className="flex-1 w-full rounded-lg overflow-hidden">
                {generatedFileUrl ? (
                  fileType === "pdf" ? (
                    <iframe
                      src={generatedFileUrl}
                      title="Generated file"
                      className="w-full h-full rounded-lg bg-white"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col min-h-0">
                      <div className="flex-1 min-h-0">
                        <DocxPreview url={generatedFileUrl} />
                      </div>

                      <a
                        href={generatedFileUrl}
                        download
                        className="flex items-center justify-center text-white hover:text-white/80 transition py-2 shrink-0"
                      >
                        <FaFileDownload size={20} />
                      </a>
                    </div>
                  )
                ) : (
                  <div
                    ref={translatedBoxRef}
                    dir={isRtl ? "rtl" : "ltr"}
                    className={`w-full h-full bg-white/20 border border-white/20 rounded-lg p-3 text-white/90 overflow-y-auto whitespace-pre-wrap ${
                      isRtl ? "text-right" : "text-left"
                    }`}
                  >
                    {loading ? (
                      <span className="text-white/40">Translating...</span>
                    ) : outputText ? (
                      <>
                        {displayedText}
                        {isStreaming && (
                          <span className="animate-pulse">▋</span>
                        )}
                      </>
                    ) : (
                      <span className="text-white/40">
                        Translation will appear here...
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom: chat-style prompt bar — narrower, auto-growing height */}
          <div className="w-full max-w-2xl mx-auto bg-white/10 border border-white/20 rounded-xl p-3 flex items-end gap-3">
            <FaRobot className="text-white text-sm size-7 shrink-0 mb-1" />

            <textarea
              ref={instructionRef}
              rows={1}
              placeholder={
                threadId
                  ? "Give a change instruction, e.g. 'make it more formal'"
                  : "Optional instruction — e.g. 'make it more formal'"
              }
              value={instruction}
              onChange={(e) => {
                setInstruction(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 bg-white/20 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-white/30 resize-none overflow-y-auto leading-relaxed [&::-webkit-scrollbar]:w-1"
              style={{ minHeight: "40px", maxHeight: "160px" }}
            />

            <button
              onClick={handleSend}
              disabled={loading}
              className="shrink-0 px-3 py-2 rounded-lg bg-[#9f7c55] text-white font-medium text-xs hover:bg-[#c19a6b] hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? "..." : <AiOutlineSend className="text-sm size-6" />}
            </button>
          </div>
        </div>
      </div>
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Save to Project</h3>
              <button
                onClick={() => setShowProjectModal(false)}
                className="text-white/60 hover:text-white transition text-sm"
              >
                ✕
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto flex flex-col gap-2 mb-4">
              {projects.length === 0 && (
                <p className="text-white/40 text-sm">No projects yet.</p>
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
                onChange={(e) => setNewProjectName(e.target.value)}
                className="flex-1 bg-white/20 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/50 text-sm outline-none focus:ring-2 focus:ring-white/30"
              />
              <button
                onClick={handleCreateAndAdd}
                disabled={savingToProject || !newProjectName.trim()}
                className="px-4 py-2 rounded-lg bg-white text-slate-900 font-medium text-sm hover:bg-white/90 transition disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Selection popup — placed last, renders on top of everything */}
      {popup.visible && (
        <div
          style={{
            position: "fixed",
            left: popup.x,
            top: popup.y - 40,
            transform: "translateX(-50%)",
          }}
          className="z-50"
        >
          <button
            onClick={insertSelectionIntoInstruction}
            className="bg-white text-slate-900 text-xs font-medium px-3 py-1.5 rounded-full shadow-lg hover:bg-white/90 transition flex items-center gap-1"
          >
            Change <RiArrowGoBackFill />
          </button>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
