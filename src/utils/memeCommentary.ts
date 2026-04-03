import { EventType } from '../types/simulator';

type Lang = 'tr' | 'en';

const LINES: Record<EventType, Record<Lang, string[]>> = {
  goal: {
    tr: [
      'GOL! GOL! GOL! YEEE-ES! Adam çıldırdı!',
      'Ağları havalandırdı! BU OLUR MU ÖYLE!',
      'VAY AKKAŞAM! NE GOL O NE GOL!',
      'GİRDİİİ! Seyirciler yerinden fırladı!',
      'Topu yerleştirdi köşeye, kaleci sadece izledi!',
      'MUAZZAM! Bu golü kim atar ki?!',
      'Süper Lig\'e bedel bir gol! Harikaaaaaa!',
      'Şampiyon gibi gol! Dünya Kupası bu beyler!',
      'Füze gibi! Kalecinin eli bile değmedi!',
      'BUUUUUM! Ağ paramparça oldu!',
    ],
    en: [
      'GOOOAL! Absolute scenes!',
      'GET IN! What a finish! The crowd erupts!',
      'NET BUSTER! The keeper had zero chance!',
      'WORLDIE! That is going straight into the highlights reel!',
      'OUT OF NOWHERE! Unbelievable!',
      'TOP BINS! Pure filth!',
      'CLINICAL! Right in the bottom corner!',
      'He doesn\'t miss from there! Ice cold!',
      'BOOM! Right through the keeper\'s legs!',
      'The striker says: take that!',
    ],
  },

  yellow_card: {
    tr: [
      'Sarı kart! Biraz sakinleşmek lazım kardeşim!',
      'Hakem gösterdi sarıyı! Aman dikkat!',
      'Bir daha yaparsan evine erken gidersin!',
      'Oyun sertleşiyor! Sarı kart verildi.',
      'Sarı kart! Hakem bunu çok çabuk çıkardı!',
      'SAKIN OL! Sarı kart gördü!',
    ],
    en: [
      'Yellow card! Cool it down, mate!',
      'Booked! One more and he is off!',
      'The referee has had enough of that!',
      'Into the book! That was reckless!',
      'He will remember that yellow card later in the game!',
      'Cautioned! The temperature is rising!',
    ],
  },

  red_card: {
    tr: [
      'KIRMIZI KART! Oyun bitti onun için! GİT!',
      'KOVULDU! Takımı 10 kişi kaldı! Felaket!',
      'Hakem cebini çekti, kırmızıyı gösterdi! Erken duş!',
      'GİT GİT GİT! Sahayı terk et kardeşim!',
      'İNANILMAZ! Bu kadar aptalca bir hareket görmedim!',
    ],
    en: [
      'RED CARD! He is off! Down to ten men!',
      'SENT OFF! That changes everything!',
      'Early bath! See you in three matches!',
      'DISMISSED! Absolutely no complaints there!',
      'Off he goes! Shocking challenge!',
    ],
  },

  save: {
    tr: [
      'SÜPER KURTAR! Kaleci harika bir müdahale yaptı!',
      'Kaleci son anda devreye girdi! İnanılmaz!',
      'Gol olmayacak mıydı? Kaleci hayır dedi!',
      'DUVAR GİBİ DURDU! İnanılmaz kurtarış!',
      'Uzanıp aldı! Kaleci bu maçın adamı!',
      'TUTTU! Bunu nasıl tuttu?! Anlayamadım!',
    ],
    en: [
      'INCREDIBLE SAVE! The keeper denies them!',
      'What a stop! Absolutely world-class goalkeeping!',
      'He flies to his left and pushes it wide!',
      'DENIED! That had goal written all over it!',
      'The keeper steals the show! Magnificent!',
      'How did he keep that out?! Unreal reflexes!',
    ],
  },

  foul: {
    tr: [
      'Faul! Hakem düdüğü çaldı, serbest vuruş var.',
      'Sert müdahale! Faul verildi.',
      'Oyun durdu — serbest vuruş.',
      'Ohhh! Bu biraz fazla sert olmadı mı?',
      'Kötü bir müdahale, hakem hemen düdüğü çaldı.',
    ],
    en: [
      'Foul! Free kick awarded.',
      'The referee blows his whistle! Late challenge!',
      'Caught him late! Free kick given.',
      'That is a foul! Dangerous play!',
      'Play stops for a free kick in a dangerous area!',
    ],
  },

  var_check: {
    tr: [
      'VAR KONTROLÜ! Bekleyin, ekranlar kontrol ediliyor...',
      'VAR devrede! Hakem monitörü izliyor... gerilim dorukta!',
      'VAR VAR VAR! Seyirciler gergin bekliyor!',
      'Teknoloji sahaya girdi! VAR inceliyor...',
      'Maç durdu... VAR ne diyecek bakalım!',
    ],
    en: [
      'VAR CHECK! The referee is reviewing the incident...',
      'VAR is checking... the crowd holds its breath!',
      'We are waiting for VAR! It could go either way!',
      'Check underway! Could this decision be overturned?',
      'The referee goes to the monitor! Drama!',
    ],
  },

  injury: {
    tr: [
      'Oyuncu yerde! Medikal ekip sahaya koşuyor.',
      'Sakatlık var! Oyun durdu, umarım ciddi değildir.',
      'Oyuncu ayağa kalkıyor, devam edebileceğe benziyor.',
      'Uzun bir ara! Oyuncu tedavi görüyor.',
    ],
    en: [
      'Player down! The physio is running on!',
      'Injury stoppage! Let us hope it is nothing serious.',
      'He is back on his feet! Good news for his team.',
      'Treatment needed! Play is stopped.',
    ],
  },

  kickoff: {
    tr: [
      'BAŞLIYORUZ! Düdük çaldı, maç başladı! Her şey mümkün!',
      'İlk düdük! Saha yeşil, oyun canlı!',
    ],
    en: [
      'KICK OFF! The match is underway! Anything can happen!',
      'And we are off! The referee starts play!',
    ],
  },

  halftime: {
    tr: [
      'İLK YARI SONA ERDİ! Devre arası. Çay molası!',
      'Hakem ilk yarıyı bitirdi! Soyunma odaları açılıyor.',
    ],
    en: [
      'HALF TIME! Players head to the dressing rooms!',
      'The referee blows for half time! What a first half!',
    ],
  },

  fulltime: {
    tr: [
      'MAÇ BİTTİ! Son düdük çaldı! Bu mücadele sona erdi!',
      'FİNAL DÜDÜĞÜ! Peki kazanan kim?!',
      'BİTTİ! Herkes gözleri skora çevirdi!',
    ],
    en: [
      'FULL TIME! That is the final whistle!',
      'IT IS OVER! What a match we have witnessed!',
      'THE REFEREE BLOWS FOR FULL TIME! Drama until the end!',
    ],
  },
};

export function getCommentary(type: EventType, lang: Lang = 'en'): string {
  const pool = LINES[type]?.[lang] ?? LINES[type]?.en ?? ['...'];
  return pool[Math.floor(Math.random() * pool.length)];
}
