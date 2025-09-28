const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const form = document.getElementById("upload-form");
const popup = document.getElementById("popup");

// store current variable file name for preset
window.currentVarsFile = null;

// Click fallback
dropZone.addEventListener("click", () => fileInput.click());

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(form);

  try {
    // Pause current audio if any
    const audio = document.getElementById("audio");
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }

    // Upload new file
    const res = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const result = await res.json();
      console.log("[DEBUG] Uploaded:", result.audio, result.vars);

      // Reset audio player with new audio file
      const newAudio = resetAudio(result.audio);
      newAudio.load();

      // Save current variables filename globally
      window.currentVarsFile = result.vars;

      // Reset globals so preset reloads fresh
      presetModule = null;
      sourceNode = null;

      showPopup(`🎶 Visualizer reset with ${result.audio}`);
    } else {
      showPopup("❌ Upload failed!");
    }
  } catch (err) {
    showPopup("⚠️ Error during upload process.");
    console.error(err);
  }
});

function resetAudio(filename) {
  const container = document.getElementById("player-container");
  container.innerHTML = ""; // clear old one

  const newAudio = document.createElement("audio");
  newAudio.id = "audio";
  newAudio.src = `uploads/${filename}`;
  newAudio.autoplay = false;
  newAudio.preload = "auto";
  container.appendChild(newAudio);

  // Explicitly pause and reset
  newAudio.pause();
  newAudio.currentTime = 0;

  // 🔑 Rebind toggle button each time
  const toggleBtn = document.getElementById("toggle-audio");
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      if (newAudio.paused) {
        newAudio.play();
        toggleBtn.textContent = "Pause";
      } else {
        newAudio.pause();
        toggleBtn.textContent = "Play";
      }
    };

    // Sync if user interacts with native controls (if you keep them)
    newAudio.addEventListener("play", () => {
      toggleBtn.textContent = "Pause";
    });
    newAudio.addEventListener("pause", () => {
      toggleBtn.textContent = "Play";
    });
  }

  return newAudio;
}


function showPopup(message) {
  popup.textContent = message;
  popup.classList.add("show");
  setTimeout(() => popup.classList.remove("show"), 2000); // hide after 2s
}

// Drag over
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

// Drag leave
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

// Drop
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    dropZone.textContent = e.dataTransfer.files[0].name;
  }
});

// Change (if clicked to select)
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) {
    dropZone.textContent = fileInput.files[0].name;
  }
});
