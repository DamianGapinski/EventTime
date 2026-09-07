import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const { filename, contentType } = await request.json();
    
    // Tworzymy unikalną nazwę pliku, żeby uniknąć nadpisywania
    const uniqueFilename = `${Date.now()}-${filename.replace(/\s+/g, '_')}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: uniqueFilename,
      ContentType: contentType,
    });

    // Generujemy podpisany link (ważny przez 5 minut)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    
    // Bezpośredni publiczny URL do pliku po wgraniu
    const publicUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFilename}`;

    return NextResponse.json({ success: true, uploadUrl, publicUrl });
  } catch (error) {
    console.error("Błąd podczas generowania linku S3:", error);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}