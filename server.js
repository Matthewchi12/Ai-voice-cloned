app.post("/api/generate", async (req, res) => {
  try {
    const { text, voiceId } = req.body;

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

    const response = await fetch(
      "https://api.fish.audio/v1/tts",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${process.env.FISH_API_KEY}`,
          "Content-Type": "application/json",
          "model": "s2.1-pro-free"
        },

        body: JSON.stringify({
          text: text.trim(),
          reference_id: voiceId,
          format: "mp3"
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "FISH AUDIO ERROR:",
        response.status,
        errorText
      );

      return res.status(response.status).json({
        success: false,
        message: `Fish Audio error ${response.status}: ${errorText}`
      });
    }

    const audioBuffer =
      Buffer.from(await response.arrayBuffer());

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Content-Disposition":
        'inline; filename="voice-clone.mp3"',
      "Cache-Control": "no-store"
    });

    res.send(audioBuffer);

  } catch (error) {

    console.error(
      "SERVER ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
