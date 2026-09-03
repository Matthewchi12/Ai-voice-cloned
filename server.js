const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 10000;
const OPENVOICE_URL = process.env.OPENVOICE_URL;

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "25mb"
}));

// ===============================
// ROOT
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Voice Clone API is running",
    openvoiceConfigured: Boolean(OPENVOICE_URL)
  });
});

// ===============================
// HEALTH
// ===============================

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "online"
  });
});

// ===============================
// OPENVOICE STATUS
// ===============================

app.get("/api/openvoice-status", async (req, res) => {
  if (!OPENVOICE_URL) {
    return res.status(500).json({
      success: false,
      connected: false,
      message: "OPENVOICE_URL is not configured on Render."
    });
  }

  try {
    const url = `${OPENVOICE_URL.replace(/\/$/, "")}/health`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        connected: false,
        message: "OpenVoice server is not responding correctly."
      });
    }

    return res.json({
      success: true,
      connected: true,
      message: "OpenVoice server is reachable."
    });

  } catch (error) {
    return res.status(502).json({
      success: false,
      connected: false,
      message: "Could not connect to OpenVoice server.",
      error: error.message
    });
  }
});

// ===============================
// CLONE VOICE
// ===============================

app.post("/api/clone", async (req, res) => {
  if (!OPENVOICE_URL) {
    return res.status(500).json({
      success: false,
      message: "OPENVOICE_URL is missing on Render."
    });
  }

  return res.status(501).json({
    success: false,
    message:
      "The /api/clone endpoint is available, but the OpenVoice cloning service has not been connected yet."
  });
});

// ===============================
// GENERATE SPEECH
// ===============================

app.post("/api/generate", async (req, res) => {
  try {
    const { text, voiceId, speed } = req.body;

    if (!OPENVOICE_URL) {
      return res.status(500).json({
        success: false,
        message: "OPENVOICE_URL is missing on Render."
      });
    }

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

    const openVoiceUrl =
      `${OPENVOICE_URL.replace(/\/$/, "")}/generate`;

    console.log("Sending generation request to OpenVoice...");
    console.log("Voice ID:", voiceId);

    const response = await fetch(openVoiceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text.trim(),
        voice_id: voiceId,
        speed: Number(speed) || 1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "OpenVoice error:",
        response.status,
        errorText
      );

      return res.status(502).json({
        success: false,
        message: "OpenVoice generation failed.",
        error: errorText
      });
    }

    const audioBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (!audioBuffer.length) {
      return res.status(502).json({
        success: false,
        message: "OpenVoice returned empty audio."
      });
    }

    console.log(
      "Audio generated:",
      audioBuffer.length,
      "bytes"
    );

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Content-Disposition":
        'attachment; filename="voice-clone.mp3"',
      "Cache-Control": "no-store"
    });

    return res.send(audioBuffer);

  } catch (error) {
    console.error(
      "GENERATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to generate voice."
    });
  }
});

// ===============================
// 404
// ===============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found.",
    path: req.originalUrl,
    method: req.method
  });
});

// ===============================
// ERROR HANDLER
// ===============================

app.use((error, req, res, next) => {
  console.error("EXPRESS ERROR:", error);

  res.status(500).json({
    success: false,
    message: "Internal server error."
  });
});

// ===============================
// START
// ===============================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `AI Voice Clone API running on port ${PORT}`
  );

  if (OPENVOICE_URL) {
    console.log("OpenVoice URL configured.");
  } else {
    console.log(
      "WARNING: OPENVOICE_URL is not configured."
    );
  }
});
