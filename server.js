const express = require("express");
const cors = require("cors");
const multer = require("multer");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

if (!process.env.FISH_API_KEY) {
  console.error("ERROR: FISH_API_KEY is missing from .env");
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/wave",
      "audio/mp4",
      "audio/x-m4a",
      "audio/ogg",
      "audio/webm"
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Unsupported audio format. Please upload MP3, WAV, M4A, OGG or WebM."
        )
      );
    }
  }
});


/*
|--------------------------------------------------------------------------
| Health check
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Fish Audio Voice Clone API is running"
  });
});


/*
|--------------------------------------------------------------------------
| CREATE VOICE CLONE
|--------------------------------------------------------------------------
*/

app.post("/api/clone", upload.single("voice"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload or record a voice sample."
      });
    }

    const voiceName =
      req.body.name?.trim() || `My Voice ${Date.now()}`;

    const form = new FormData();

    form.append("type", "tts");
    form.append("title", voiceName);
    form.append("train_mode", "fast");
    form.append("visibility", "private");
    form.append(
      "description",
      "Private voice clone created by the user."
    );

    form.append(
      "voices",
      new Blob([req.file.buffer], {
        type: req.file.mimetype
      }),
      req.file.originalname || "voice-sample.wav"
    );

    form.append("enhance_audio_quality", "true");
    form.append("generate_sample", "false");

    const response = await fetch(
      "https://api.fish.audio/model",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FISH_API_KEY}`
        },
        body: form
      }
    );

    const contentType = response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = {
        message: await response.text()
      };
    }

    if (!response.ok) {
      console.error("Fish clone error:", data);

      return res.status(response.status).json({
        success: false,
        message:
          data?.message ||
          data?.detail ||
          "Fish Audio could not create the voice clone.",
        error: data
      });
    }

    const voiceId = data._id || data.id;

    if (!voiceId) {
      return res.status(500).json({
        success: false,
        message: "Fish Audio did not return a voice ID.",
        data
      });
    }

    return res.json({
      success: true,
      message: "Voice clone created successfully.",
      voiceId,
      voice: data
    });

  } catch (error) {
    console.error("Clone error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Voice cloning failed."
    });
  }
});


/*
|--------------------------------------------------------------------------
| GENERATE SPEECH
|--------------------------------------------------------------------------
*/

app.post("/api/generate", async (req, res) => {
  try {
    const { text, voiceId, speed } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter some text."
      });
    }

    if (!voiceId) {
      return res.status(400).json({
        success: false,
        message: "Please create a voice clone first."
      });
    }

    const cleanText = text.trim();

    if (cleanText.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Text is too long. Maximum is 5,000 characters."
      });
    }

    let speechSpeed = Number(speed);

    if (!Number.isFinite(speechSpeed)) {
      speechSpeed = 1;
    }

    speechSpeed = Math.max(
      0.5,
      Math.min(2, speechSpeed)
    );

    const fishRequest = {
      text: cleanText,
      reference_id: voiceId,

      temperature: 0.7,
      top_p: 0.7,

      prosody: {
        speed: speechSpeed,
        volume: 0,
        normalize_loudness: true
      },

      chunk_length: 300,
      normalize: true,

      format: "mp3",

      sample_rate: 44100,
      mp3_bitrate: 128,

      latency: "normal",

      max_new_tokens: 1024,
      repetition_penalty: 1.2,

      min_chunk_length: 50,

      condition_on_previous_chunks: true,

      early_stop_threshold: 1
    };

    const response = await fetch(
      "https://api.fish.audio/v1/tts",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${process.env.FISH_API_KEY}`,
          "Content-Type": "application/json",
          model: "s2-pro"
        },

        body: JSON.stringify(fishRequest)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Fish TTS error:",
        response.status,
        errorText
      );

      return res.status(response.status).json({
        success: false,
        message:
          "Fish Audio could not generate the speech.",
        error: errorText
      });
    }

    const audioBuffer =
      Buffer.from(await response.arrayBuffer());

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Content-Disposition":
        'inline; filename="fish-voice.mp3"',
      "Cache-Control": "no-store"
    });

    return res.send(audioBuffer);

  } catch (error) {
    console.error("Generate error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Speech generation failed."
    });
  }
});


/*
|--------------------------------------------------------------------------
| ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use((error, req, res, next) => {
  console.error(error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Audio file is too large. Maximum size is 20MB."
      });
    }
  }

  return res.status(400).json({
    success: false,
    message: error.message || "Request failed."
  });
});


/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(
    `Fish Voice Clone API running on port ${PORT}`
  );
});
