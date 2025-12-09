import Navbar from '../shared/Navbar';

export default function UserLayout({ children }) {
  return (
    <div className="user-layout flex flex-col min-h-screen">
      <Navbar />
      <main className="main-content flex-1 w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
