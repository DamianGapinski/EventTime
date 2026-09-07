import { NextResponse } from 'next/server';

// Tymczasowa tablica w pamięci serwera przechowująca przesłane pliki
let dbMedia: any[] = [];

export async function GET() {
  return NextResponse.json({ success: true, data: dbMedia });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newItem = {
      id: Date.now().toString(),
      url: body.url,
      resourceType: body.type || 'image',
      authorName: body.authorName || 'Gość',
      comments: [],
      likes: 0,
      createdAt: new Date().toISOString(),
    };
    
    dbMedia.unshift(newItem); // Dodajemy najnowsze pliki na początek listy
    return NextResponse.json({ success: true, data: newItem });
  } catch (error: any) {
    console.error('Błąd zapisu w API:', error);
    return NextResponse.json(
      { error: 'Błąd zapisu pliku', details: error?.message || error },
      { status: 500 }
    );
  }
}