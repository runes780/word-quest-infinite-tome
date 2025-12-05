/**
 * Vision Model OCR - Dynamically fetches and uses free vision models from OpenRouter
 * 
 * Fetches available models from OpenRouter API in real-time and filters for free vision-capable models.
 */

// OpenRouter model info from API
interface OpenRouterModel {
    id: string;
    name: string;
    pricing: {
        prompt: string;
        completion: string;
        image?: string;
    };
    context_length: number;
    architecture?: {
        modality?: string;
        input_modalities?: string[];
    };
}

// Known working free vision models (fallback list)
const KNOWN_FREE_VISION_MODELS = [
    'qwen/qwen2-vl-7b-instruct:free',
    'qwen/qwen-2-vl-7b-instruct:free',
    'meta-llama/llama-3.2-11b-vision-instruct:free',
    'meta-llama/llama-3.2-90b-vision-instruct:free'
];

// Known working paid vision models (fallback)
const KNOWN_PAID_VISION_MODELS = [
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'anthropic/claude-3-5-sonnet',
    'anthropic/claude-3-haiku',
    'google/gemini-pro-vision',
    'google/gemini-1.5-flash'
];

// Cached models (refreshed periodically)
let cachedModels: OpenRouterModel[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fetch available models from OpenRouter API
export async function fetchAvailableModels(): Promise<OpenRouterModel[]> {
    const now = Date.now();

    // Use cache if fresh
    if (cachedModels.length > 0 && now - lastFetchTime < CACHE_DURATION) {
        return cachedModels;
    }

    try {
        console.log('[Vision] Fetching models from OpenRouter...');
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                'HTTP-Referer': 'https://wordquest.app',
                'X-Title': 'Word Quest'
            }
        });

        if (!response.ok) {
            console.error('[Vision] Failed to fetch models:', response.status);
            return cachedModels; // Return cached if available
        }

        const data = await response.json();
        cachedModels = data.data || [];
        lastFetchTime = now;

        console.log(`[Vision] Fetched ${cachedModels.length} models`);
        return cachedModels;
    } catch (error) {
        console.error('[Vision] Error fetching models:', error);
        return cachedModels;
    }
}

// Check if a model DEFINITELY supports vision/images (strict check)
function isVisionModel(model: OpenRouterModel): boolean {
    // STRICT: Only accept if explicitly listed in input_modalities
    if (model.architecture?.input_modalities?.includes('image')) {
        return true;
    }
    // Check modality string for image
    if (model.architecture?.modality === 'text+image->text') {
        return true;
    }
    return false;
}

// Check if a model is free
function isFreeModel(model: OpenRouterModel): boolean {
    // Model ID ends with :free
    if (model.id.endsWith(':free')) {
        return true;
    }
    // Check if pricing is 0
    const promptCost = parseFloat(model.pricing?.prompt || '1');
    const completionCost = parseFloat(model.pricing?.completion || '1');
    return promptCost === 0 && completionCost === 0;
}

// Get free vision models from API + known working models
export async function getFreeVisionModels(): Promise<OpenRouterModel[]> {
    const models = await fetchAvailableModels();

    // Strict filtering: only models with explicit vision support
    const freeVision = models.filter(m => isFreeModel(m) && isVisionModel(m));

    // Add known working models not already in the list
    const existingIds = new Set(freeVision.map(m => m.id));
    for (const knownId of KNOWN_FREE_VISION_MODELS) {
        if (!existingIds.has(knownId)) {
            const foundModel = models.find(m => m.id === knownId);
            if (foundModel) {
                freeVision.push(foundModel);
            }
        }
    }

    console.log(`[Vision] Found ${freeVision.length} free vision models:`, freeVision.map(m => m.id));
    return freeVision;
}

// Get all vision models (free first, then known paid)
export async function getAllVisionModels(): Promise<OpenRouterModel[]> {
    const models = await fetchAvailableModels();
    const visionModels = models.filter(isVisionModel);

    // Add known paid models as fallback
    const existingIds = new Set(visionModels.map(m => m.id));
    for (const knownId of KNOWN_PAID_VISION_MODELS) {
        if (!existingIds.has(knownId)) {
            const foundModel = models.find(m => m.id === knownId);
            if (foundModel) {
                visionModels.push(foundModel);
            }
        }
    }

    // Sort: free models first
    return visionModels.sort((a, b) => {
        const aFree = isFreeModel(a) ? 0 : 1;
        const bFree = isFreeModel(b) ? 0 : 1;
        return aFree - bFree;
    });
}

// OCR Prompts
const OCR_SYSTEM_PROMPT = `You are an OCR assistant. Extract ALL text from the image exactly as written.
- Preserve line breaks and formatting
- Include all visible text (headings, paragraphs, captions, etc.)
- If text is in a foreign language, transcribe it as-is
- Do not add explanations or commentary
- If no text is visible, respond with "[NO TEXT DETECTED]"`;

const OCR_USER_PROMPT = "Extract all text from this image. Return only the extracted text, nothing else.";

// Convert File to base64 data URL
export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// Resize image if too large (max 4MB base64)
export async function resizeImageIfNeeded(
    base64: string,
    maxSizeBytes: number = 4 * 1024 * 1024
): Promise<string> {
    const currentSize = base64.length * 0.75;
    if (currentSize <= maxSizeBytes) return base64;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const scaleFactor = Math.sqrt(maxSizeBytes / currentSize) * 0.9;
            const newWidth = Math.floor(img.width * scaleFactor);
            const newHeight = Math.floor(img.height * scaleFactor);

            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            const resized = canvas.toDataURL('image/jpeg', 0.85);
            console.log(`[Vision] Resized image from ${Math.round(currentSize / 1024)}KB to ${Math.round(resized.length * 0.75 / 1024)}KB`);
            resolve(resized);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = base64;
    });
}

export interface VisionOCRResult {
    text: string;
    model: string;
    success: boolean;
    error?: string;
}

// Perform OCR using vision model
export async function performVisionOCR(
    apiKey: string,
    imageBase64: string
): Promise<VisionOCRResult> {
    // Fetch available free vision models
    const models = await getFreeVisionModels();

    if (models.length === 0) {
        console.warn('[Vision] No free vision models found, trying all vision models...');
        const allVision = await getAllVisionModels();
        if (allVision.length === 0) {
            return { text: '', model: '', success: false, error: 'No vision models available' };
        }
        models.push(...allVision.slice(0, 5)); // Try first 5 vision models
    }

    // Resize image if needed
    let processedImage: string;
    try {
        processedImage = await resizeImageIfNeeded(imageBase64);
    } catch (e) {
        console.error('[Vision] Image processing failed:', e);
        return { text: '', model: '', success: false, error: 'Image processing failed' };
    }

    // Try each model in order
    const errors: string[] = [];

    for (const model of models) {
        console.log(`[Vision] Trying ${model.id}...`);

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://wordquest.app',
                    'X-Title': 'Word Quest OCR'
                },
                body: JSON.stringify({
                    model: model.id,
                    messages: [
                        { role: 'system', content: OCR_SYSTEM_PROMPT },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: OCR_USER_PROMPT },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: processedImage,
                                        detail: 'high'
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 4096
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`[Vision] ${model.id} failed: ${response.status} - ${errorText}`);
                errors.push(`${model.id}: ${response.status}`);

                if (response.status === 429) {
                    await new Promise(r => setTimeout(r, 2000));
                }
                continue;
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content?.trim();

            if (text && text !== '[NO TEXT DETECTED]') {
                console.log(`[Vision] Success with ${model.id}! Extracted ${text.length} chars`);
                return { text, model: model.name || model.id, success: true };
            }

            console.log(`[Vision] ${model.id} returned no text`);
            errors.push(`${model.id}: no text`);

        } catch (error) {
            const errMsg = (error as Error).message;
            console.error(`[Vision] ${model.id} error:`, errMsg);
            errors.push(`${model.id}: ${errMsg}`);
            continue;
        }
    }

    return {
        text: '',
        model: '',
        success: false,
        error: `All models failed: ${errors.join(', ')}`
    };
}

// Quick OCR function for file input
export async function ocrFromFile(
    apiKey: string,
    file: File
): Promise<VisionOCRResult> {
    try {
        const base64 = await fileToBase64(file);
        return performVisionOCR(apiKey, base64);
    } catch (error) {
        return {
            text: '',
            model: '',
            success: false,
            error: `Failed to read file: ${(error as Error).message}`
        };
    }
}
