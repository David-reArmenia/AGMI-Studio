# Product Requirements Document (PRD): AGMI Localization Hub

> **Version**: 2.0 | **Last Updated**: 2026-02-01 | **Status**: Draft for Review

---

## 1. Executive Summary

The **AGMI Localization Hub** is a web-based enterprise application for the **Armenian Genocide Museum-Institute (AGMI)**. It enables museum staff to create, translate, and produce multi-language audio guides from source documents. The platform integrates AI-powered translation (Google Gemini), terminology management with IPA pronunciation, and advanced Text-to-Speech (TTS) generation with multi-vendor support.

---

## 2. Problem Statement

Creating audio guides for a sensitive historical subject requires:
-   **Precision**: Historical terms, names, and locations must be handled consistently across all languages.
-   **Pronunciation**: Audio guides often mispronounce local names (toponyms, historical figures).
-   **Efficiency**: Manual translation and audio production for multiple languages is slow and error-prone.

---

## 3. Goals & Objectives
-   **Centralize Workflow**: Manage the entire lifecycle (script ingestion → translation → audio generation) in one place.
-   **Enforce Accuracy**: Use a verified Glossary/Term base to control translation output.
-   **Automate Pronunciation**: Generate IPA transcriptions for TTS or human voice actors.
-   **Scale Languages**: Support Armenian (HY), English (EN), Russian (RU) as source languages; expand to many target languages.
-   **Multi-Vendor TTS**: Allow selection of different TTS providers with advanced prosody controls.

---

## 4. Target Audience
-   **Museum Content Curators**: Upload original scripts and manage historical accuracy.
-   **Translators/Editors**: Review AI-generated translations.
-   **Audio Engineers**: Utilize the final scripts/audio for physical guide devices.

---

## 5. Overall Application Structure

### 5.1 Top Navigation
-   **Dashboard**
-   **Source Materials** (Tab 1)
-   **Translation** (Tab 2)
-   **TTS & Audio Output** (Tab 3)
-   **Dictionaries & Terms** (Optional: as separate view OR integrated panel)

### 5.2 Project Entity Model
Each project contains:
| Field             | Description                                           |
| :---------------- | :---------------------------------------------------- |
| `id`              | Unique project identifier                             |
| `name`            | Project title                                         |
| `sourceLang`      | **Strict** source language (HY, EN, or RU)            |
| `targetLangs`     | One or more target languages                          |
| `createdAt`       | Creation timestamp                                    |
| `lastModified`    | Last modification timestamp                           |
| `status`          | `DRAFT` / `TRANSLATING` / `TTS_GENERATING` / `READY`  |
| `progress`        | Overall workflow completion percentage                |
| `assets`          | Uploaded source documents                             |
| `terms`           | Detected/defined glossary terms                       |
| `translations`    | Translated content per target language                |

---

## 6. Key Features (Detailed)

### 6.1 Dashboard (Screen 1)

**Purpose**: Manage existing audio guide projects.

#### UI Components
-   **Project Table/Grid**: Displays all projects with columns for Name, Source Lang, Target Langs, Last Modified, Status, Progress, Actions.
-   **Filters**: Status, Source Language, Target Languages, Date Range, Search.
-   **Progress Bar**: Visual indicator of workflow completion per project.

#### Operations
| Action        | Description                                             |
| :------------ | :------------------------------------------------------ |
| Create New    | Opens modal to create a new project                     |
| Open          | Opens the project editor                                |
| Duplicate     | Creates a copy of an existing project                   |
| Archive       | Moves project to archive (soft delete)                  |
| Export        | Exports project data (script + dictionary + audio)      |
| Delete        | Permanently removes project with confirmation           |

#### Create Project Modal
-   **Project Name** (required)
-   **Source Language** (dropdown: Armenian / English / Russian)
-   **Target Languages** (multi-select)
-   **Upload Initial Documents** (optional: .md, .pdf, .docx, .txt)
-   **Upload Dictionary File** (optional)

---

### 6.2 Source Materials (Tab 1)

**Purpose**: Upload, parse, and curate source documents; detect and manage glossary terms.

#### Layout: 3-Column Workspace

| Left Panel: Sources         | Center Panel: Editor                     | Right Panel: Terms                        |
| :-------------------------- | :--------------------------------------- | :---------------------------------------- |
| Upload area (drag/drop)     | Large document editor                    | "Run Term Detection" button               |
| File list with status       | Section headings, merge view             | Term list grouped by category             |
| Add / Remove / Reorder      | AI Assist toolbar                        | Upload dictionary file                    |
| Source language indicator   | Highlighted terms inline                 | Merge detected + uploaded                 |

#### Source Panel Features
-   **Supported Import Formats**: `.md`, `.pdf`, `.docx`, `.doc`, `.txt`
-   **File List**: Name, type icon, upload progress, parsing status, last modified, author.
-   **Strict Language Indicator**: "Source language locked: Armenian" (cannot mix languages).
-   **Operations**: Add files, Remove, Reorder, Combine selections.

#### Editor Features
-   **Rich Text Editor**: Section headings, merge view, version history.
-   **AI Assist Toolbar**:
    -   Summarize
    -   Rewrite
    -   Simplify
    -   Merge selected segments
    -   Remove duplicates
    -   Style normalization
-   **"Combine Sources"**: Merge multiple assets into a single curated script.
-   **Term Highlighting**: Color-coded inline highlighting by category (toponym, figure, etc.).

#### Term Detection & Dictionary Panel
-   **"Run Term Detection" Button**: Triggers AI analysis with progress bar and logs.
-   **Term List**: Grouped by category (Toponyms, Ethnonyms, Historical Terms, Figures, Dates).
-   **Per-Term Row**: Text, IPA, Confidence score, Occurrence count, Status, Edit button, Pronunciation preview.
-   **Dictionary Upload**: Upload `.json` dictionary file → triggers AI structuring.
-   **Merge Options**: Detected + Uploaded; Conflict Resolution UI (side-by-side suggestions).
-   **Export Dictionary**: Download as JSON.

#### Bottom Action Bar
-   **Save Draft**
-   **Submit to Translation** → Locks source script version (with confirmation dialog).

---

### 6.3 Translation (Tab 2)

**Purpose**: Translate curated script into multiple target languages with term consistency.

#### Layout: Split Screen + Glossary Sidebar

| Left Pane: Source (Read-Only) | Right Pane: Target Editor     | Sidebar: Glossary             |
| :---------------------------- | :---------------------------- | :---------------------------- |
| Highlighted source text       | Editable translation          | Term translations per lang    |
| Term markers visible          | AI Assist toolbar             | IPA transcription fields      |
|                               |                               | Approval status per term      |

#### Top Bar
-   **Target Language Selector** (multi-select tabs)
-   **Translation Status** per language (progress bar, status chip)
-   **View Toggle**: Side-by-side / Stacked

#### Editor Features
-   **Source Pane**: Read-only, with highlighted terms.
-   **Target Pane**: Editable translation text.
-   **AI Assist**:
    -   Improve translation tone
    -   Fix consistency for toponyms/ethnonyms
    -   Generate phonetic hints for target language

#### Glossary Sidebar
-   **Term Consistency Warnings**: Alerts when translation deviates from glossary.
-   **Per-Term Fields**: Target text, IPA/transcription, Notes, Approval status.
-   **Status Options**: Approved / Needs Review.

#### Bottom Action Bar
-   **Save**
-   **Proceed to TTS & Audio Output** → Locks translation version per language (with confirmation).

---

### 6.4 TTS & Audio Output (Tab 3) — **PRIORITY IMPLEMENTATION**

**Purpose**: Generate high-quality audio files with advanced speech controls and multi-vendor support.

#### Layout: 3-Panel Dashboard

| Left: Vendor & Voice Profile | Center: Speech Controls         | Right: SSML Preview & Output    |
| :--------------------------- | :------------------------------ | :------------------------------ |
| Vendor dropdown              | Prosody sliders                 | Live SSML code preview          |
| Voice profile cards          | Advanced toggles                | Vendor compatibility warnings   |
| Sample playback              | Pronunciation strictness        | Output file list                |

#### Left Panel: Vendor + Voice Profile
-   **Vendor Dropdown**: Google TTS, ElevenLabs, Qwen, Azure, Other.
-   **Dynamic Configuration**: Available voices, voice cloning options, supported SSML features change per vendor.
-   **Voice Profile Card**:
    -   Sample playback button
    -   Tags: Gender, Age, Style
    -   Language compatibility indicator
-   **Voice Cloning**: (If vendor supports) Upload reference audio, create custom voice.

#### Center Panel: Speech Controls
-   **Prosody Sliders**:
    | Control          | Description                                      | Range       |
    | :--------------- | :----------------------------------------------- | :---------- |
    | Emphasis         | Dramatic stress on key terms                     | 0.0 - 2.0   |
    | Gravity/Solemnity| Emotional weight for sensitive history           | 0.0 - 2.0   |
    | Pacing           | Speech rate                                      | 0.5x - 2.0x |
    | Pause Distribution| Natural pause insertion frequency               | Low/Med/High|

-   **Advanced Options**:
    -   Pronunciation Strictness: Use dictionary strongly vs softly.
    -   Segmenting: By paragraph / By section.
    -   Noise Reduction / Normalization toggle.

#### Right Panel: SSML Preview & Output
-   **SSML Preview Window**: Shows how dictionary phonetics become vendor-specific SSML.
    ```xml
    <speak version="1.0" xml:lang="en">
      <prosody rate="0.95" pitch="+5%">
        Welcome to the <phoneme alphabet="ipa" ph="t͡sit͡sɛrnɑkɑˈbɛrt">Tsitsernakaberd</phoneme> Memorial...
      </prosody>
    </speak>
    ```
-   **Vendor Compatibility Warnings**: Alerts for unsupported SSML tags with auto-fallback suggestions.
-   **Output Section**:
    -   Audio format selector: MP3 / WAV / OGG
    -   Bitrate / Quality selector
    -   **Generate Button**: Multi-stage progress (Preprocessing → SSML Compile → Synthesis → Package).
    -   **Output File List**: Per target language with Status, Download, Regenerate, Audit Log.

#### Bottom Action Bar
-   **Save Settings**
-   **Generate All**
-   **Export Final Package** (audio files + scripts + dictionary JSON + metadata)

---

## 7. Technical Requirements

### 7.1 Technology Stack
| Component            | Technology                                |
| :------------------- | :---------------------------------------- |
| Frontend             | React 19, TypeScript, Vite                |
| Styling              | Tailwind CSS                              |
| AI Translation       | Google GenAI SDK (`@google/genai`)        |
| Document Processing  | `mammoth` (DOCX), `pdfjs-dist` (PDF)      |
| TTS Vendors (Planned)| Google TTS, ElevenLabs, OpenAI, Azure     |

### 7.2 Supported Source Languages
-   Armenian (HY)
-   English (EN)
-   Russian (RU)

### 7.3 Supported Target Languages
-   English, French, Russian, German, Spanish, Italian, Turkish, Arabic, and extensible.

### 7.4 Non-Functional Requirements
-   **Data Sensitivity**: Content is historical and sensitive; ensure integrity.
-   **Performance**: Handle large text blocks (5000+ chars) without UI freeze.
-   **Accessibility**: High contrast options, keyboard-friendly controls.
-   **UX**: Museum-grade, serious tone; minimal but modern design.

---

## 8. Roadmap & Priorities

| Phase | Focus                                      | Status         |
| :---- | :----------------------------------------- | :------------- |
| 1     | MVP: Source Materials + Translation        | ✅ Implemented  |
| 2     | **TTS & Audio Output (Full)**              | 🎯 **Priority** |
| 3     | Dashboard Enhancements (Filters, Actions)  | ⏳ Planned      |
| 4     | Dictionary Management (Upload, Merge)      | ⏳ Planned      |
| 5     | AI Assist Features (Summarize, Rewrite)    | ⏳ Planned      |
| 6     | Version Locking & Audit Logs               | ⏳ Planned      |
| 7     | User Auth & Cloud Persistence              | ⏳ Future       |

---

## 9. Acceptance Criteria for TTS Stage (Priority)

### 9.1 Vendor Selection
-   [ ] Dropdown to select TTS vendor (at least 2: Google TTS, ElevenLabs placeholder).
-   [ ] Vendor selection dynamically updates available voices.
-   [ ] API key management UI (store in local storage or env).

### 9.2 Voice Profile
-   [ ] Display voice cards with name, tags (gender/style), language compatibility.
-   [ ] Sample playback button for each voice.

### 9.3 Prosody Controls
-   [ ] Functional sliders for Emphasis, Solemnity, Pacing.
-   [ ] Sliders update SSML preview in real-time.

### 9.4 SSML Generation
-   [ ] Generate valid SSML incorporating glossary IPA for terms.
-   [ ] Display SSML preview in right panel.
-   [ ] Show warnings for unsupported tags per vendor.

### 9.5 Audio Generation & Export
-   [ ] "Generate" button triggers TTS API call.
-   [ ] Progress indicator during generation.
-   [ ] Download generated audio file (MP3).
-   [ ] Display output file list with status.
