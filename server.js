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

    console.log("Generating OpenVoice speech...");
    console.log("Voice ID:", voiceId);

    const response = await fetch(
      `${process.env.OPENVOICE_URL}/generate`,
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

    const audioBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (!audioBuffer.length) {
      return res.status(500).json({
        success: false,
        message: "OpenVoice returned empty audio."
      });
    }

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Content-Disposition":
        'attachment; filename="voice-clone.mp3"',
      "Cache-Control": "no-store"
    });

    res.send(audioBuffer);

  } catch (error) {
    console.error("SERVER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error."
    });
  }
});
