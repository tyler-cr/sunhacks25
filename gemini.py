from google import genai
from google.genai import types
from google.genai import files

import json
import os
import re
import main

# The client gets the API key from the environment variable `GEMINI_API_KEY`.
client = genai.Client()

csv_path = os.path.join(os.path.dirname(__file__), "static", "visualizer_defaults.csv")
csvfile = client.files.upload(file=csv_path)

audiofile = os.path.join(os.path.dirname(__file__), "uploads", "place.mp3")

def getPreset(audio_file):
    print("attempting to grab preset from gemini")

    global audio_path 
    audio_path = os.path.join(os.path.dirname(__file__),"uploads", "place.mp3")
    global audiofile 
    audiofile = audio_file


    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                "given the audio file, choose which preset you believe fits best. "
                "please only say: 'bar-spectrum', 'heart-spectrum','heart-waveform', "
                "'radial-spectrum', 'radial-waveform', 'rain-spectrum', or 'waveform'. ",
                audiofile
            ],
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=0)
            )
        )
        print(f"Grabbed {response.text} from gemini")
        return response.text
    except Exception as e:
        raise RuntimeError(f"Failed to generate preset: {e}")
    
import re

def getVariables():
    print("attempting to grab variables from gemini")

    global csvfile
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                "with the given audio file, write "
                "'bar_count, clear_color, time_scale, base_color_low, base_color_high, intensity_gamma, "
                "base_radius, radius_scale, line_thickness, drop_height_min, drop_height_max, "
                "fall_speed_min, fall_speed_max, drop_spacing_min, drop_spacing_max, "
                "activation_threshold, edge_softness_inner, edge_softness_outer = "
                "INT, HEXSTRING, FLOAT, HEXSTRING, HEXSTRING, "
                "FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, FLOAT' "
                "where INT, HEXSTRING, and FLOAT are values based on the song’s vibe. "
                "Use the CSV file for sensible defaults, but FEEL FREE TO EXPIREMENT.",
                audiofile, csvfile,
            ],
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=0)
            )
        )

        text = response.text.strip()
        # print(f"Grabbed {text} from gemini")

        # Wrap hex color codes in quotes so Python won't treat them as comments
        text = re.sub(r"(#[0-9A-Fa-f]{6})", r"'\1'", text)

        # Use isolated namespace
        local_vars = {}
        exec(text, {}, local_vars)

        visualizer_variables = {k: local_vars.get(k) for k in [
            "bar_count", "clear_color", "time_scale", "base_color_low", "base_color_high",
            "intensity_gamma", "base_radius", "radius_scale", "line_thickness",
            "drop_height_min", "drop_height_max", "fall_speed_min", "fall_speed_max",
            "drop_spacing_min", "drop_spacing_max", "activation_threshold",
            "edge_softness_inner", "edge_softness_outer"
        ]}

        return json.dumps(visualizer_variables)

    except Exception as e:
        raise RuntimeError(f"Failed to generate variables: {e}")

upload_counter = 0

def write_js_variables(filename):
    
    output_path = f"uploads/{filename}"

    js_code = f"export const visualizerVariables = {getVariables()};\n"
    with open(output_path, "w") as f:
        f.write(js_code)
    print("successfully wrote / created visualizer_variables")

