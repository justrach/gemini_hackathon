import { NextRequest, NextResponse } from 'next/server'
import { getGeminiService } from '@/lib/gemini'

const SECRET_HASH = '85ee0a054f8f053342b0b9131026b455'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-internal-auth')
    if (authHeader !== SECRET_HASH) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const { prompt, images, mode = 'generate', targetDimensions } = await request.json()
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }
    
    const gemini = getGeminiService()
    let imageData: string
    
    switch (mode) {
      case 'generate':
        imageData = await gemini.generateImage(prompt)
        break
        
      case 'edit':
        if (!images || images.length === 0) {
          return NextResponse.json(
            { error: 'Base image is required for editing mode' },
            { status: 400 }
          )
        }
        imageData = await gemini.editImage(images[0].data, prompt, images[0].mimeType, targetDimensions)
        break
        
      case 'compose':
        if (!images || images.length === 0) {
          return NextResponse.json(
            { error: 'At least one image is required for composition mode' },
            { status: 400 }
          )
        }
        imageData = await gemini.composeImages(images, prompt)
        break
        
      default:
        return NextResponse.json(
          { error: 'Invalid mode. Use generate, edit, or compose' },
          { status: 400 }
        )
    }
    
    return NextResponse.json({
      success: true,
      base64: imageData,
      prompt,
      mode,
      timestamp: new Date().toISOString(),
    })
    
  } catch (error) {
    console.error('Gemini API error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false 
      },
      { status: 500 }
    )
  }
}
