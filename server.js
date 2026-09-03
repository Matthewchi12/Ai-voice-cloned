const express = require("express");
const cors = require("cors");

const app = express();

// ===============================
// BASIC CONFIG
// ===============================

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
// HEALTH CHECK
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Voice Clone API is running",
    openvoiceConfigured: !!OPENVOICE_URL
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "online"
  });
});

// ===============================
// OPENVOICE CONFIG CHECK
// ===============================

app.get("/api/openvoice-status", (req, res) => {
  if (!OPENVOICE_URL) {
    return res.status(500).json({
      success: false,
      connected: false,
      message: "OPENVOICE_URL is not configured on Render."
    });
  }

  res.json({
    success: true,
    connected: true,
    message: "OPENVOICE_URL is configured."
  });
});

// ===============================
// GENERATE SPEECH
// ===============================

app.post("/api/generate", async (req, res) => {
  try {
    const { text, voiceId, speed } = req.body;

    // Check OpenVoice configuration
    if (!OPENVOICE_URL) {
      return res.status(500).json({
        success: false,
        message: "OPENVOICE_URL is missing on Render."
      });
    }

    // Check text
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter some text."
      });
    }

    // Check cloned voice
    if (!voiceId) {
      return res.status(400).json({
        success: false,
        message: "Please create a voice clone first."
      });
    }

    console.log("Generating OpenVoice speech...");
    console.log("Voice ID:", voiceId);
    console.log("Text length:", text.trim().length);

    const response = await fetch(
      `${OPENVOICE_URL.replace(/\/$/, "")}/generate`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          text: text.trim(),
          voice_id: voiceId,
          speed: Number(speed) || 1
        })
      }
    );

    console.log(
      "OpenVoice response status:",
      response.status
    );

    // OpenVoice returned an error
    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "OPENVOICE ERROR:",
        response.status,
        errorText
      );

      return res.status(response.status).json({
        success: false,
        message: `OpenVoice error: ${errorText}`
      });
    }

    // Get generated audio
    const audioBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (!audioBuffer.length) {
      return res.status(500).json({
        success: false,
        message: "OpenVoice returned empty audio."
      });
    }

    console.log(
      "Audio generated:",
      audioBuffer.length,
      "bytes"
    );

    // Return MP3 to frontend
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
      "GENERATE SERVER ERROR:",
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
// 404 HANDLER
// ===============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found."
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
// START SERVER
// ===============================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `AI Voice Clone API running on port ${PORT}`
  );

  if (OPENVOICE_URL) {
    console.log(
      "OpenVoice URL configured."
    );
  } else {
    console.log(
      "WARNING: OPENVOICE_URL is not configured."
    );
  }
});
