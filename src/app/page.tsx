import Image from "next/image";
import styles from "./page.module.css";
import Link from 'next/link';

export default function Home() {
  return (
    <>
    <header>
      <h1><strong>Damian & Viktoria</strong><br/><br/> Uwiecznij wszystkie chwile</h1>
      
      <Link href="/galeria">
      <button>Przejdź do aplikacji</button>
      </Link>
      
    </header>
    <main>
      <ol>
        <li><h3>1.Naciśnij przycisk "Przejdź do aplikacji"</h3></li>
        <li><h3>2.Zrób lub dodaj zdjęcie/film z galerii</h3></li>
        <li><h3>3.Podziel się pięknymi chwilami</h3></li>
        <li><h3>4.Przeglądaj wszystkie piękne chwile</h3></li>
        <li><h3>5.Likój i komentuj zdjęcia/filmy innych urzytkowników</h3></li>
        <li><h3>6.Bierz udział w grach i zabawach razem z innymi urzytkownikami</h3></li>
        <li><h3>7.Zdobywaj punkty i wygrywaj nagrody</h3></li>
      </ol>
      <Link href="/galeria">
      <button>Przejdź do aplikacji</button>
      </Link>
    </main>
    
    </>
    
   
  );
}
