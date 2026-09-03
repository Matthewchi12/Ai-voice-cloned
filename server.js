app.post("/api/generate", async (req, res) => {
  try {
    const { text, voiceId, speed } = req.body;
    if (!process.env.FISH_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "FISH_API_KEY is missing on Render."
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
    console.log("Generating speech...");
    console.log("Voice ID:", voiceId);
    const response = await fetch(
      "https://api.fish.audio/v1/tts",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.FISH_API_KEY}`,
          "Content-Type": "application/json",
          /*
           * Fish Audio model
           */
          "model": "s2.1-pro-free"
        },
        body: JSON.stringify({
          text: text.trim(),
          reference_id: voiceId,
          format: "mp3",
          /*
           * Optional speed
           */
          prosody: {
            speed: Number(speed) || 1
          }
        })
      }
    );
    console.log(
      "Fish Audio status:",
      response.status
    );
    if (!response.ok) {
      const errorText =
        await response.text();
      console.error(
        "FISH AUDIO ERROR:",
        response.status,
        errorText
      );
      return res.status(response.status).json({
        success: false,
        message:
          `Fish Audio error ${response.status}: ${errorText}`
      });
    }
    const audioBuffer =
      Buffer.from(
        await response.arrayBuffer()
      );
    if (!audioBuffer.length) {
      return res.status(500).json({
        success: false,
        message:
          "Fish Audio returned an empty audio file."
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
        'inline; filename="voice-clone.mp3"',
      "Cache-Control":
        "no-store"
    });
    res.send(audioBuffer);
  } catch (error) {
    console.error(
      "SERVER ERROR:",
      error
    );
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Internal server error."
    });
  }
});
