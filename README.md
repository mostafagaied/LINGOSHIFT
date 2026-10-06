# LingoShift

AI-powered document translation platform — translate text, PDF, and Word documents while preserving original formatting, images, and layout.

## Features

- **Text, PDF, and DOCX translation** — paste raw text or upload a document; get a translated version back in the same format.
- **Format-preserving document generation** — translated DOCX/PDF files retain original fonts, styles, images, and layout wherever possible.
- **RTL language support** — correct right-to-left rendering and text direction for Arabic and other RTL languages, in both the UI and generated documents.
- **AI-assisted editing** — select any part of a translation and ask the AI to adjust tone, wording, or style before finalizing.
- **Human-in-the-loop approval** — review and approve a translation before the final document is generated.
- **Live document preview** — in-browser preview of both the original and translated PDF/DOCX, with zoom and drag-and-drop upload.
- **User accounts** — secure authentication (JWT, hashed passwords) with protected routes.
- **History** — browse all past translations, grouped by date, with quick access to both original and translated files.
- **Projects** — organize translated documents into named projects; add, remove, rename, or delete as needed.
- **Document detail view** — side-by-side comparison of original and translated documents for any saved file.

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** FastAPI (Python), Prisma ORM, PostgreSQL
- **AI:** LangChain, LangGraph (translation agent with human-in-the-loop tool approval), Google Gemini
- **Document processing:** python-docx, PyMuPDF, pdf2docx, LibreOffice (headless DOCX→PDF conversion)
