import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import BackgroundTaskRunner from '../common/BackgroundTaskRunner';
import ToastContainer from '../common/ToastContainer';

import { LoginGate } from '../auth/LoginGate';

function Layout() {
    return (
        <LoginGate>
            <div className="flex h-screen w-full bg-background font-sans antialiased">
                <Sidebar />
                <main className="flex-1 flex flex-col overflow-hidden">
                    <Outlet />
                </main>
                <BackgroundTaskRunner />
                <ToastContainer />
            </div>
        </LoginGate>
    );
}

export default Layout;
