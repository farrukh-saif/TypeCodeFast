import { codeToHtml } from 'https://esm.sh/shiki@1.3.0';

// --- Configuration & State ---
const MAX_SNIPPET_LINES = 15;
const CHARS_PER_WORD = 5;
const SHIKI_THEME = 'github-dark';
let currentLanguage = 'javascript'; // Default, update based on upload later if needed
let currentCodeToFormat = ''; // Raw code for redo
let formattedCode = ''; // Snippet being typed against
let lastResultStats = { time: 0, wpm: 0 };
let startTime = null;
let timerRunning = false;
let charWidth = null;
let lineHeight = null;

// --- DOM References ---
const views = document.querySelectorAll('.view');
// Home View
const homeView = document.getElementById('home-view');
const uploadButtonHome = document.getElementById('upload-button-home');
const randomButtonHome = document.getElementById('random-button-home');
const fileInputHome = document.getElementById('file-input-home');
// Typing View
const typingView = document.getElementById('typing-view');
const snippetOutputHolder = document.getElementById('snippet-output');
const inputOutputHolder = document.getElementById('input-output');
const typingAreaElement = document.getElementById('typing-area');
const errorMessageElement = document.getElementById('error-message');
const fileInfoSpan = document.getElementById('file-info');
const highlightedInputContainer = document.getElementById('highlighted-input-container');
const diffButton = document.getElementById('diff-button');
const backButton = document.getElementById('back-button');
// Result View
const resultView = document.getElementById('result-view');
const resultTimeSpan = document.getElementById('result-time');
const resultWpmSpan = document.getElementById('result-wpm');
const redoButton = document.getElementById('redo-button');
const newSnippetButton = document.getElementById('new-snippet-button');


// --- View Management ---
function showView(viewId) {
    views.forEach(view => {
        view.style.display = view.id === viewId ? 'flex' : 'none'; // Use flex as it's the body display
    });
}

// --- Utility: Measure Chars ---
function measureCharMetrics() {
    const styles = getComputedStyle(typingAreaElement);
    lineHeight = parseFloat(styles.lineHeight);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = `${styles.fontSize} ${styles.fontFamily}`;
    charWidth = context.measureText("M").width;
    if (!charWidth || charWidth === 0) charWidth = parseFloat(styles.fontSize) * 0.6;
    if (!lineHeight || isNaN(lineHeight)) lineHeight = parseFloat(styles.fontSize) * 1.5;
}
// --- Utility: Get Char Position ---
function getCharacterPosition(index) {
    if (charWidth === null) measureCharMetrics();

    const textBeforeIndex = typingAreaElement.value.substring(0, index);
    const lines = textBeforeIndex.split('\n');
    const lineIndex = lines.length - 1;
    const charIndexInLine = lines[lineIndex].length;

    // Get padding from the textarea itself
    const styles = getComputedStyle(typingAreaElement);
     // Use parseFloat with fallback for CSS variable resolution issues
     const paddingTop = parseFloat(styles.paddingTop) || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--code-padding') || '16');
     const paddingLeft = parseFloat(styles.paddingLeft) || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--code-padding') || '16');
     // Get effective visual top padding including title bar space
     const visualPaddingTop = paddingTop; // Already includes title bar space due to CSS adjustments

    // Calculate position relative to the textarea's scroll viewport
    // (Top-left corner of where text *actually starts visually*)
     const top = (lineIndex * lineHeight) + visualPaddingTop - typingAreaElement.scrollTop;
     const left = (charIndexInLine * charWidth) + paddingLeft - typingAreaElement.scrollLeft;

    // Return position relative to the container for overlay placement
    return { top, left };
}

// --- Core Function: Format and Display Snippet (for Typing View) ---
async function displaySnippet(code, sourceFileName = "Unknown") {
    currentCodeToFormat = code; // Store raw code for redo
    // Determine language (simple for now)
    currentLanguage = sourceFileName.toLowerCase().endsWith('.py') ? 'python' : 'javascript'; // Basic detection example
    console.log(`Displaying snippet from ${sourceFileName}, lang: ${currentLanguage}`);

    errorMessageElement.textContent = ''; errorMessageElement.classList.remove('success');
    fileInfoSpan.textContent = `Typing: ${sourceFileName} (${currentLanguage})`;
    snippetOutputHolder.innerHTML = `<pre class="shiki" style="background-color: #282c34;"><code>Formatting and highlighting...</code></pre>`;

    try {
        const parser = currentLanguage === 'python' ? 'python' : 'babel'; // Choose prettier parser
        const plugins = currentLanguage === 'python' ? [prettierPlugins.python] : prettierPlugins; // Choose plugin

        const lines = code.split('\n');
        formattedCode = lines.slice(0, MAX_SNIPPET_LINES).join('\n');

        // // Format with Prettier
        // const fullFormattedCode = prettier.format(code, {
        //     parser: parser, plugins: plugins, tabWidth: 2
        // }).trim();
        // const lines = fullFormattedCode.split('\n');
        // formattedCode = lines.slice(0, MAX_SNIPPET_LINES).join('\n'); // This is the target text

        // Highlight using Shiki
        const highlightedHtml = await codeToHtml(formattedCode, {
            lang: currentLanguage, theme: SHIKI_THEME
        });
        snippetOutputHolder.innerHTML = highlightedHtml;
        snippetOutputHolder.closest('.code-container')?.classList.remove('error-state');

        await resetInputArea(); // Reset input for typing

    } catch (error) {
            // ... (error handling as before) ...
        console.error("Formatting/Display error:", error);
        const errorMsg = `Error processing ${sourceFileName}: ${error.message}`;
        snippetOutputHolder.innerHTML = `<pre class="shiki" style="color: red; background-color: #ffebeb;"><code>${errorMsg}</code></pre>`;
        snippetOutputHolder.closest('.code-container')?.classList.add('error-state');
        errorMessageElement.textContent = errorMsg; errorMessageElement.classList.remove('success');
        typingAreaElement.disabled = true; formattedCode = ''; timerRunning = false; startTime = null;
    }
}

// --- Helper: Reset User Input Area (for Typing View) ---
async function resetInputArea() {
    typingAreaElement.value = '';
    errorMessageElement.textContent = ''; errorMessageElement.classList.remove('success');

    // Generate Shiki HTML for empty input
    const emptyHighlightedHtml = await codeToHtml('', { lang: currentLanguage, theme: SHIKI_THEME });
    inputOutputHolder.innerHTML = emptyHighlightedHtml;

    // Reset scrolls
    typingAreaElement.scrollTop = 0; typingAreaElement.scrollLeft = 0;
    const shikiPre = inputOutputHolder.querySelector('pre.shiki');
    if (shikiPre) { shikiPre.scrollTop = 0; shikiPre.scrollLeft = 0; }

    // Reset Timer
    startTime = null; timerRunning = false;

    typingAreaElement.disabled = false;
    typingAreaElement.focus();

    // Reset visual states
    highlightedInputContainer.style.outline = 'none';
    document.querySelectorAll('.char-flash-overlay').forEach(el => el.remove());
    inputOutputHolder.closest('.code-container')?.classList.remove('error-state');
}

// --- Helper: Display Results (for Result View) ---
function displayResults() {
    resultTimeSpan.textContent = lastResultStats.time.toFixed(2);
    resultWpmSpan.textContent = lastResultStats.wpm;
}


// --- Event Listeners ---

randomButtonHome.addEventListener('click', async () => {
    currentCodeToFormat = `let a = 1;
let b = 2;
let c = a + b;
console.log(c);`;
    currentLanguage = "javascript";
    showView('typing-view');
    await displaySnippet(currentCodeToFormat);
});

// Home View: Upload Button
uploadButtonHome.addEventListener('click', () => fileInputHome.click());

// Home View: File Input
fileInputHome.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // TODO: Add more robust language detection if needed
    // if (!file.name.toLowerCase().endsWith('.js') && !file.name.toLowerCase().endsWith('.py')) {
    //     alert('Please select a JavaScript (.js) or Python (.py) file.');
    //     fileInputHome.value = '';
    //     return;
    // }

    const reader = new FileReader();
    reader.onload = async (e) => {
        currentCodeToFormat = e.target.result; // Store the raw code
        // Basic language detection based on extension
            currentLanguage = file.name.toLowerCase().endsWith('.py') ? 'python' : 'javascript';
        fileInputHome.value = ''; // Reset file input

        // Show typing view and display the snippet
        showView('typing-view');
        await displaySnippet(currentCodeToFormat, file.name);
    };
    reader.onerror = (e) => {
        console.error("File reading error:", e);
        alert(`Error reading file: ${file.name}`);
        fileInputHome.value = '';
    };
    reader.readAsText(file);
});


// Typing View: Diff Button
diffButton.addEventListener('click', checkDifference);

// Typing View: Back Button
backButton.addEventListener('click', () => {
    showView('home-view');
        // Stop timer if running when going back
        timerRunning = false;
        startTime = null;
});

// Typing View: Input Listener
typingAreaElement.addEventListener('input', async () => {
    const typedText = typingAreaElement.value;

    // Start Timer
    if (!timerRunning && typedText.length > 0) { /* ... */ startTime = Date.now(); timerRunning = true; console.log("Timer started!"); errorMessageElement.textContent = ''; errorMessageElement.classList.remove('success'); document.querySelectorAll('.char-flash-overlay').forEach(el => el.remove()); }

    // Highlight
        try {
            const highlightedHtml = await codeToHtml(typedText, { lang: currentLanguage, theme: SHIKI_THEME });
            inputOutputHolder.innerHTML = highlightedHtml;
        } catch (error) { /* ... fallback ... */ }

    // Check Completion
    if (timerRunning && typedText === formattedCode) {
        const endTime = Date.now();
        timerRunning = false; // Stop timer first
        const durationSeconds = (endTime - startTime) / 1000;
        const durationMinutes = durationSeconds / 60;

        let wpm = 0;
        if (durationMinutes > 0) {
            const wordCount = formattedCode.length / CHARS_PER_WORD;
            wpm = Math.round(wordCount / durationMinutes);
        }

        lastResultStats = { time: durationSeconds, wpm: wpm }; // Store results
        startTime = null; // Reset start time

        console.log(`Completed in ${durationSeconds.toFixed(2)}s, WPM: ${wpm}`);

        // Show results view
        showView('result-view');
        displayResults(); // Populate results view

        highlightedInputContainer.style.outline = '2px solid limegreen'; // Keep outline on typing view for context maybe?

    } else if (timerRunning) {
            highlightedInputContainer.style.outline = 'none';
    }
});

// Typing View: Scroll Sync
typingAreaElement.addEventListener('scroll', () => {
    const shikiPre = inputOutputHolder.querySelector('pre.shiki');
        if (shikiPre) {
        shikiPre.scrollTop = typingAreaElement.scrollTop;
        shikiPre.scrollLeft = typingAreaElement.scrollLeft;
        }
});

// Typing View: Keydown (Tab/Enter)
typingAreaElement.addEventListener('keydown', (e) => {
        const start = typingAreaElement.selectionStart;
    const end = typingAreaElement.selectionEnd;
    const currentValue = typingAreaElement.value;
    if (e.key === 'Tab') {
        e.preventDefault();
        const indent = ' '.repeat(parseInt(getComputedStyle(typingAreaElement).tabSize) || 2);
        typingAreaElement.value = currentValue.substring(0, start) + indent + currentValue.substring(end);
        typingAreaElement.selectionStart = typingAreaElement.selectionEnd = start + indent.length;
        typingAreaElement.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (e.key === 'Enter') {
        e.preventDefault();
        const lastNewline = currentValue.lastIndexOf('\n', start - 1);
        const currentLineStart = lastNewline === -1 ? 0 : lastNewline + 1;
        const currentLine = currentValue.substring(currentLineStart, start);
        const match = currentLine.match(/^(\s*)/);
        const indentation = match ? match[1] : '';
        const textToInsert = '\n' + indentation;
        typingAreaElement.value = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
        typingAreaElement.selectionStart = typingAreaElement.selectionEnd = start + textToInsert.length;
        typingAreaElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
});

// Typing View: Paste Prevention
typingAreaElement.addEventListener('paste', (e) => { e.preventDefault();
    // we can show a toast here to let the user know that pasting is not allowed
    alert('Pasting is not allowed. Please type the code instead.');
 });

// Typing View: Diff Check Function
function checkDifference() {
        errorMessageElement.textContent = ''; errorMessageElement.classList.remove('success'); document.querySelectorAll('.char-flash-overlay').forEach(el => el.remove());
        const typedText = typingAreaElement.value; let diffIndex = -1; const len = Math.min(typedText.length, formattedCode.length);
        for (let i = 0; i < len; i++) { if (typedText[i] !== formattedCode[i]) { diffIndex = i; break; } }
        if (diffIndex === -1 && typedText.length !== formattedCode.length) { diffIndex = len; }
        if (diffIndex !== -1) {
            typingAreaElement.selectionStart = diffIndex; typingAreaElement.selectionEnd = diffIndex; typingAreaElement.focus();
            try {
                const pos = getCharacterPosition(diffIndex);
                const flashElement = document.createElement('div');
                flashElement.className = 'char-flash-overlay';
                flashElement.style.width = `${charWidth || 8}px`;
                flashElement.style.height = `${lineHeight || 18}px`;
                // Position the overlay relative to the container
                flashElement.style.top = `${pos.top}px`;
                flashElement.style.left = `${pos.left}px`;
                // Append to the main container which holds the textarea
                highlightedInputContainer.appendChild(flashElement); // Append to the overall container
                setTimeout(() => { flashElement.style.opacity = '0'; setTimeout(() => flashElement.remove(), 500); }, 500);
            } catch (calcError) { console.error("Could not calculate character position for flash:", calcError); errorMessageElement.textContent = `Difference found near index ${diffIndex}.`; setTimeout(() => { errorMessageElement.textContent = ''; }, 1500); }
        } else { errorMessageElement.textContent = 'No difference found!'; errorMessageElement.classList.add('success'); typingAreaElement.focus(); }
    }

// Result View: Redo Button
redoButton.addEventListener('click', async () => {
    showView('typing-view');
    await displaySnippet(currentCodeToFormat, "Same Snippet");
});

// Result View: Upload New Button
newSnippetButton.addEventListener('click', () => {
    showView('home-view');
    currentCodeToFormat = '';
    formattedCode = '';
});

// --- Global Keydown Listener for Shortcuts ---
window.addEventListener('keydown', (e) => {
    // Check if Typing view is active
    if (typingView.style.display === 'flex') {
        // Check for Cmd+K or Ctrl+K
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
            e.preventDefault(); // Prevent browser default action (e.g., search)
            console.log("Cmd/Ctrl+S detected - Checking difference");
            checkDifference();
        }
    }
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
        if (typeof prettier !== 'undefined') {
            measureCharMetrics(); // Measure metrics once
            // Show home view initially
            showView('home-view');
            // No need to load default snippet automatically anymore
            // await displaySnippet(defaultOriginalCode);
        } else {
            console.error("Prettier not loaded!");
            errorMessageElement.textContent = "Error loading essential libraries.";
            document.body.innerHTML = 'Error loading libraries. Please check the console.'; // Show critical error
        }
});