from flask import Flask, jsonify, send_from_directory, render_template, request
import gemini
import os

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"

for filename in os.listdir(UPLOAD_FOLDER):
    if (filename.startswith("tempFile") or filename.startswith("visualizer_variables")):
        try:
            os.remove(os.path.join(UPLOAD_FOLDER, filename))
            print(f"[DEBUG] Deleted leftover {filename}")
        except Exception as e:
            print(f"[WARNING] Could not delete {filename}: {e}")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

upload_counter = 0
active_mp3 = "place.mp3"
active_vars = None

@app.route("/upload", methods=["POST"])
def upload_file():
    global upload_counter, active_vars

    if "music" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["music"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    _, ext = os.path.splitext(file.filename)

    # Increment counter for each upload
    upload_counter += 1

    # Save audio file as tempFileN
    audio_filename = f"tempFile{upload_counter}{ext}"
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], audio_filename)
    file.save(save_path)

    # Save matching variable file
    vars_filename = f"visualizer_variables{upload_counter}.js"
    gemini.write_js_variables(vars_filename)  # <-- make sure gemini.py accepts filename arg

    # Track the current active vars file
    active_vars = vars_filename

    print(f"[DEBUG] Saved {audio_filename} and {vars_filename}")

    return jsonify({
        "audio": audio_filename,
        "vars": vars_filename
    })




# 2️⃣ Serve uploaded files
@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

# route: get-preset (updated to return JSON)
@app.route("/get-preset")
def get_preset_route():
    return jsonify({"script_path": resolve_preset()})

def resolve_preset():
    global active_mp3
    print(f"[DEBUG] creating presets and variables from {active_mp3}")
    cachedPreset = gemini.getPreset(active_mp3)
    return f"presets/{cachedPreset}-script.js"

@app.route("/")
def index():
    # Serve the main page
    return render_template("index.html")

@app.route("/reset-flags")
def flag_reset():
    global geminiFlag
    geminiFlag = False
    return jsonify({"status": "ok", "geminiFlag": geminiFlag})

@app.route("/delete-temp", methods=["POST"])
def delete_temp():
    _, ext = os.path.splitext("tempFile.mp3")  # adjust if you need multiple formats
    file_path = os.path.join(app.config["UPLOAD_FOLDER"], f"tempFile{ext}")

    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            print(f"[DEBUG] Deleted {file_path}")
            return jsonify({"status": "deleted"})
        except PermissionError:
            print(f"[WARNING] Could not delete {file_path} (file in use)")
            return jsonify({"status": "locked"}), 423  # 423 Locked
    return jsonify({"status": "not_found"})

@app.after_request
def add_header(response):
    if request.path.startswith("/uploads/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# route: get-script (updated to also use resolve_preset)
@app.route("/get-script")
def get_script():
    return jsonify({"script_path": resolve_preset()})

@app.route("/active-vars")
def current_var():
    global active_vars
    if not active_vars:
        return jsonify({"vars": None})
    return jsonify({"vars": active_vars})

if __name__ == "__main__":
    app.run(debug=True, port=8000)
