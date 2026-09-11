import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicjalizacja klienta Supabase dla serwera
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Mapujemy kolumny z bazy na format, którego oczekuje frontend
    const formattedData = (data || []).map((item) => ({
      id: item.id,
      url: item.url,
      resourceType: item.resource_type,
      authorName: item.author_name,
      likes: item.likes,
      comments: item.comments || [],
      createdAt: item.created_at,
    }));

    return NextResponse.json({ success: true, data: formattedData });
  } catch (error: any) {
    console.error('Błąd pobierania z Supabase:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd pobierania danych', details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newItem = {
      id: Date.now().toString(),
      url: body.url,
      resource_type: body.type || 'image',
      author_name: body.authorName || 'Gość',
      likes: 0,
      comments: [],
    };

    const { data, error } = await supabase
      .from('media')
      .insert([newItem])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        id: data.id,
        url: data.url,
        resourceType: data.resource_type,
        authorName: data.author_name,
        likes: data.likes,
        comments: data.comments,
      } 
    });
  } catch (error: any) {
    console.error('Błąd zapisu w Supabase:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd zapisu pliku', details: error?.message || error },
      { status: 500 }
    );
  }
}