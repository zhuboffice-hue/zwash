import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

const Layout = () => {
    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <Outlet />
            </main>
            <MobileNav />
        </div>
    );
};

export default Layout;
