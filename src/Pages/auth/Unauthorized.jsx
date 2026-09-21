import { Link } from 'react-router-dom';

const Unauthorized = () => {
  return (
    <div className="relative min-h-[70vh] flex flex-col items-center justify-center z-0">


      <h1 className="text-6xl font-bold text-red-500 mb-4">403</h1>
      <h2 className="text-2xl font-semibold text-white mb-2">Access Denied</h2>
      <p className="text-slate-400 mb-6 text-center max-w-md">
        You do not have the required permissions to view this page. If you believe this is an error, please contact your Super Admin.
      </p>
      <Link 
        to="/" 
        className="text-white px-6 py-2.5 rounded-xl transition-all font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
      >
        Return to Dashboard
      </Link>
    </div>
  );
};

export default Unauthorized;