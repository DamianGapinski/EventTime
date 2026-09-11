import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedData = (data || []).map((item) => ({
      id: item.id,
      type: item.type,
      src: item.url,
      thumbSrc: item.thumb_url || item.url,
      authorName: item.author_name || 'Gość',
      authorAvatar: item.author_avatar || undefined,
      likes: item.likes || 0,
      comments: item.comments || [],
      createdAt: item.created_at,
    }));

    return NextResponse.json({ success: true, data: formattedData });
  } catch (error: any) {
    console.error('Błąd pobierania z Supabase:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const newRecord = {
      url: body.url,
      thumb_url: body.thumbUrl || body.url,
      type: body.type || 'image',
      author_name: body.authorName || 'Gość',
      author_avatar: body.authorAvatar || null,
      likes: 0,
      comments: [],
    };

    const { data, error } = await supabase
      .from('media')
      .insert([newRecord])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      data: {
        id: data.id,
        type: data.type,
        src: data.url,
        thumbSrc: data.thumb_url || data.url,
        authorName: data.author_name,
        authorAvatar: data.author_avatar,
        likes: data.likes,
        comments: data.comments,
      } 
    });
  } catch (error: any) {
    console.error('Błąd zapisu w Supabase:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, likes, comments } = body;

    const updateData: any = {};
    if (likes !== undefined) updateData.likes = likes;
    if (comments !== undefined) updateData.comments = comments;

    const { data, error } = await supabase
      .from('media')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Błąd aktualizacji w Supabase:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}