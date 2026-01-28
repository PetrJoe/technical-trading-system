import CandlestickChart from '@/components/CandlestickChart';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <div className="w-full h-screen">
        <CandlestickChart />
      </div>
    </main>
  );
}
