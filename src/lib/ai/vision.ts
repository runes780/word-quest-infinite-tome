/**
 * Vision Model OCR - Uses free vision-capable models from OpenRouter
 * 
 * Automatically detects and uses available free vision models for OCR.
 */

// Free vision-capable models on OpenRouter (as of 2024)
export interface VisionModel {
    id: string;
    name: string;
    free: boolean;
    maxImageSize?: number; // Max base64 size in bytes
    priority: number; // Lower = preferred
}

export const VISION_MODELS: VisionModel[] = [
    // Free Vision Models
    {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash (Free)',
        free: true,
        priority: 1
    },
    {
        id: 'google/gemini-exp-1206:free',
        name: 'Gemini Exp 1206 (Free)',
        free: true,
        priority: 2
    },
    {
        id: 'meta-llama/llama-3.2-11b-vision-instruct:free',
        name: 'Llama 3.2 11B Vision (Free)',
        free: true,
        priority: 3
    },
    {
        id: 'qwen/qwen-2-vl-7b-instruct:free',
        name: 'Qwen 2 VL 7B (Free)',
        free: true,
        priority: 4
    },
    // Paid Vision Models (fallback)
    {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        free: false,
        priority: 10
    },
    {
        id: 'anthropic/claude-3-haiku',
        name: 'Claude 3 Haiku',
        free: false,
        priority: 11
    }
];

// Get free vision models sorted by priority
export function getFreeVisionModels(): VisionModel[] {
    return VISION_MODELS
        .filter(m => m.free)
        .sort((a, b) => a.priority - b.priority);
}

// Get all vision models sorted by priority
export function getAllVisionModels(): VisionModel[] {
    return [...VISION_MODELS].sort((a, b) => a.priority - b.priority);
}

// Get the best available vision model (free preferred)
export function getBestVisionModel(preferFree: boolean = true): VisionModel {
    const models = preferFree ? getFreeVisionModels() : getAllVisionModels();
    return models[0] || VISION_MODELS[0];
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
    // Check current size
    const currentSize = base64.length * 0.75; // Approximate bytes
    if (currentSize <= maxSizeBytes) return base64;

    // Need to resize using canvas
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Calculate scale factor
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

            // Convert to JPEG for smaller size
            const resized = canvas.toDataURL('image/jpeg', 0.85);
            console.log(`[Vision OCR] Resized image from ${Math.round(currentSize / 1024)}KB to ${Math.round(resized.length * 0.75 / 1024)}KB`);
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
    imageBase64: string,
    preferredModel?: string
): Promise<VisionOCRResult> {
    // Select model
    const models = preferredModel
        ? [VISION_MODELS.find(m => m.id === preferredModel), ...getFreeVisionModels()].filter(Boolean) as VisionModel[]
        : getFreeVisionModels();

    if (models.length === 0) {
        return { text: '', model: '', success: false, error: 'No vision models available' };
    }

    // Resize image if needed
    let processedImage: string;
    try {
        processedImage = await resizeImageIfNeeded(imageBase64);
    } catch (e) {
        console.error('[Vision OCR] Image processing failed:', e);
        return { text: '', model: '', success: false, error: 'Image processing failed' };
    }

    // Try each model in order
    for (const model of models) {
        console.log(`[Vision OCR] Trying ${model.name}...`);

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
                console.warn(`[Vision OCR] ${model.name} failed: ${response.status} - ${errorText}`);

                // Rate limit - wait before trying next
                if (response.status === 429) {
                    await new Promise(r => setTimeout(r, 3000));
                }
                continue;
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content?.trim();

            if (text && text !== '[NO TEXT DETECTED]') {
                console.log(`[Vision OCR] Success with ${model.name}! Extracted ${text.length} chars`);
                return { text, model: model.name, success: true };
            }

            // Model returned no text, try next
            console.log(`[Vision OCR] ${model.name} returned no text, trying next...`);

        } catch (error) {
            console.error(`[Vision OCR] ${model.name} error:`, error);
            continue;
        }
    }

    return {
        text: '',
        model: '',
        success: false,
        error: 'All vision models failed to extract text'
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
