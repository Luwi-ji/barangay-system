import Navbar from '../shared/Navbar';

export default function AdminLayout({ children }) {
  return (
    <div className="admin-layout flex flex-col min-h-screen">
      <Navbar />
      <main className="main-content flex-1 w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
