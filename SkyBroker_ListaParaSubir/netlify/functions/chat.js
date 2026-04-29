// Servidor Backend Inteligente (Netlify Function)
// Modificado para recibir memoria (historial multihilo) inteligente.

const GROQ_API_KEY = "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";

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  try {
    const data = JSON.parse(event.body);
    const { history } = data; // Array: [{role: 'user', content: '...'}, {role: 'assistant', ...}]

    const systemPrompt = `Eres "SkyBot", un asesor virtual premium de Sky Broker, expertos en seguros en Argentina.
Hablas en perfecto español rioplatense (voseo profesional, empatía y calidez). Eres un "Closer" de ventas.

ESTRATEGIA DE VENTAS (SIGUE ESTOS PASOS ESTRICTAMENTE EN ORDEN):
PASO 1 (Enganche): Si el usuario saluda o pide cotizar, NO pidas datos personales. Pregúntale primero QUÉ quiere asegurar. Si es auto, pídele Marca, Modelo y Año.
PASO 2 (Valor y Compromiso): Una vez que da los detalles del auto/hogar, muestra interés genuino. Dile que estás filtrando las mejores opciones (La Caja, Sancor, Rivadavia).
PASO 3 (Captura de Lead): En ese mismo mensaje, dile: "Para enviarte las cotizaciones por WhatsApp, ¿me confirmarías tu número de celular y tu DNI?".
PASO 4 (Guardado): SOLO cuando tengas AMBOS DATOS (DNI y Teléfono), genera esta etiqueta oculta al final de tu respuesta: [SAVE_CONTACT:su_dni,su_telefono]
PASO 5 (Cierre): Luego de recibir los datos, imprímele SIEMPRE este botón exacto para cerrar la venta:
[Hablar con un asesor ahora](https://wa.me/5492233544868?text=Hola,%20ya%20habl%C3%A9%20con%20el%20chatbot%20y%20quiero%20seguir%20con%20mi%20cotizaci%C3%B3n)

REGLAS DE ORO:
- NUNCA inventes precios exactos.
- NUNCA pidas DNI ni celular en tu primer mensaje.
- Usa negritas (**texto**) para resaltar conceptos clave.`;

    // Armamos el array final inyectando la regla maestra de sistema al principio
    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...(history || [])
    ];

    // Procesamos con Llama 3.1 de Meta (Groq API)
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", 
        temperature: 0.7,
        messages: apiMessages
      })
    });

    const result = await groqResponse.json();
    let replyText = result?.choices?.[0]?.message?.content || "Lo siento, mi conexión cerebral no está funcionando ahora.";

    // LÓGICA DE EXTRACCIÓN Y GUARDADO (Regex Detector)
    const extractRegex = /\[SAVE_CONTACT:([^,]+),([^\]]+)\]/i;
    const match = replyText.match(extractRegex);
    
    if (match) {
        const extractedDNI = match[1].trim();
        const extractedPhone = match[2].trim();
        
        try {
            const formData = new URLSearchParams();
            formData.append('entry.474290538', extractedDNI);
            formData.append('entry.1451475778', extractedPhone);
            fetch('https://docs.google.com/forms/d/e/1FAIpQLSfYMAmVMG0Xir93-M7QQt8A1c3iUjtArQzJy3OxtomVWJOGYQ/formResponse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            }).catch(e => {}); 
        } catch (e) {}
    }

    // Borrador universal: elimina cualquier etiqueta mal formada para que el cliente nunca la vea
    replyText = replyText.replace(/\[SAVE_CONTACT:[^\]]*\]/gi, '').trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: replyText }),
    };

  } catch (error) {
    console.error('Error del IA:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Hubo una interrupción en mi sistema central. Reintente.' })
    };
  }
};
