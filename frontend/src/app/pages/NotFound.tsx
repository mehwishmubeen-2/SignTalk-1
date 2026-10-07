import { Link } from 'react-router';
import { Home, Search } from 'lucide-react';
import { Button } from '../components/ui/button';

export function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-6 px-4">
        <div className="space-y-2">
          <h1 className="text-9xl font-bold text-gray-200">404</h1>
          <h2 className="text-3xl font-bold">Page Not Found</h2>
          <p className="text-gray-600 max-w-md mx-auto">
            Sorry, the page you're looking for doesn't exist. It may have been moved or deleted.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link to="/">
            <Button size="lg" className="bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 text-white hover:opacity-90">
              <Home className="w-5 h-5 mr-2" />
              Go Home
            </Button>
          </Link>
          <Link to="/dictionary">
            <Button size="lg" variant="outline" className="border-teal-900/20 bg-white/70 text-teal-800 hover:bg-teal-50">
              <Search className="w-5 h-5 mr-2" />
              Search Dictionary
            </Button>
          </Link>
        </div>

        <div className="pt-8">
          <p className="text-sm text-gray-500">
            Need help? Try exploring our{' '}
            <Link to="/learning" className="text-teal-700 hover:underline">
              Learning Center
            </Link>
            {' '}or{' '}
            <Link to="/dashboard" className="text-teal-700 hover:underline">
              Dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
