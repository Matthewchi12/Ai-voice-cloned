import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "Voice Clone API is running"
  });
});

// Create a voice clone
app.post("/api/clone", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Please upload or record a voice sample."
      });
    }

    const name = req.body.name || `Voice-${Date.now()}`;

    const formData = new FormData();

    formData.append("name", name);

    formData.append(
      "files",
      new Blob([req.file.buffer], {
        type: req.file.mimetype
      }),
      req.file.originalname
    );

    const response = await fetch(
      "https://api.elevenlabs.io/v1/voices/add",
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY
        },
        body: formData
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.detail || "Voice cloning failed.",
        details: data
      });
    }

    res.json({
      success: true,
      voiceId: data.voice_id,
      message: "Voice created successfully."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Server error while creating voice."
    });
  }
});

// Generate speech
app.post("/api/generate", async (req, res) => {
  try {
    const { voiceId, text } = req.body;

    if (!voiceId) {
      return res.status(400).json({
        error: "Voice ID is required."
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: "Please enter some text."
      });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        error: "Speech generation failed.",
        details: errorText
      });
    }

    const audioBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length
    });

    res.send(audioBuffer);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Server error while generating speech."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
