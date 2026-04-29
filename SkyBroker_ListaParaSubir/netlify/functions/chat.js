// Servidor Backend Inteligente (Netlify Function)
// Modificado para recibir memoria (historial multihilo) inteligente.

const GROQ_API_KEY = process.env.GROQ_API_KEY;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  try {
    const data = JSON.parse(event.body);
    const { history } = data; // Array: [{role: 'user', content: '...'}, {role: 'assistant', ...}]

    const systemPrompt = `Eres el asistente virtual "SkyBot" de Sky Broker, un Productor Asesor de Seguros experto en Argentina, Mar del Plata.
Hablas en perfecto español rioplatense (tuteas / voseas con respeto). Eres cortés y servicial.
DIRECTIVAS SECUENCIALES OBLIGATORIAS (Sigue el orden paso a paso):
PASO 1: Si apenas comienza la charla, tu primer objetivo es siempre preguntar el DNI o Cédula del usuario.
PASO 2: Cuando el usuario te dé su DNI, agradécele y pídele un Teléfono Celular de contacto.
PASO 3: Cuando tengas grabado en tu memoria AMBOS DATOS (DNI y Teléfono), DEBES generar la siguiente etiqueta oculta exactamente en este formato al final de tu respuesta: [SAVE_CONTACT:su_dni,su_telefono]
PASO 4: Inmediatamente pregúntale qué Marca, Modelo y Año de vehículo (o zona/m2 si es Hogar) quiere cotizar.
PASO 5: NUNCA inventes precios exactos bajo ningún caso.
PASO 6: HANDOFF. Cuando ya tengas los datos de su vehículo y veas interés real, imprímele este botón exacto sin fallar:
[Hablar con un asesor ahora](https://wa.me/5492233544868?text=Hola,%20ya%20habl%C3%A9%20con%20el%20chatbot%20y%20quiero%20seguir%20con%20mi%20cotizaci%C3%B3n)
EXTRA: Sé siempre breve (1 o 2 párrafos).`;

    // Armamos el array final inyectando la regla maestra de sistema al principio
    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...(history || [])
    ];

    // Procesamos con Llama 3 de Meta (Groq API)
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192", 
        temperature: 0.7,
        messages: apiMessages
      })
    });

    const result = await groqResponse.json();
    let replyText = result?.choices?.[0]?.message?.content || "Lo siento, mi conexión cerebral no está funcionando ahora.";

    // LÓGICA DE EXTRACCIÓN Y GUARDADO (Regex Detector)
    // Buscamos si la IA emitió nuestro código secreto [SAVE_CONTACT:DNI,PHONE]
    const extractRegex = /\[SAVE_CONTACT:([^,]+),([^\]]+)\]/i;
    const match = replyText.match(extractRegex);
    
    if (match) {
        const extractedDNI = match[1].trim();
        const extractedPhone = match[2].trim();
        
        // Disparamos la grabación silenciosa a Google Sheets (Forms)
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

        // Borramos la etiqueta secreta del mensaje para no asustar al cliente
        replyText = replyText.replace(extractRegex, '').trim();
    }

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
