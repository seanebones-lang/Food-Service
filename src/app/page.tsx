import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Restaurant POS System
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Modern point-of-sale system with online ordering, inventory management, 
            kitchen display system, and AI-powered insights.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pos"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              POS Terminal
            </Link>
            <Link
              href="/menu"
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Online Menu
            </Link>
            <Link
              href="/kds"
              className="bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors"
            >
              Kitchen Display
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg p-6 shadow-lg">
            <div className="text-blue-600 text-3xl mb-4">🍕</div>
            <h3 className="text-xl font-semibold mb-2">Order Management</h3>
            <p className="text-gray-600">
              Handle in-person and online orders with real-time synchronization 
              and multi-channel support.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-lg">
            <div className="text-green-600 text-3xl mb-4">💳</div>
            <h3 className="text-xl font-semibold mb-2">Payment Processing</h3>
            <p className="text-gray-600">
              Integrated with Square, Toast, and Clover for seamless payment 
              processing and refunds.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-lg">
            <div className="text-orange-600 text-3xl mb-4">📱</div>
            <h3 className="text-xl font-semibold mb-2">Kitchen Display</h3>
            <p className="text-gray-600">
              Real-time order updates to kitchen staff with priority queuing 
              and preparation tracking.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-lg">
            <div className="text-purple-600 text-3xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">Inventory Management</h3>
            <p className="text-gray-600">
              Track stock levels, set alerts, and forecast usage with AI-powered 
              analytics.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-lg">
            <div className="text-red-600 text-3xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold mb-2">AI Insights</h3>
            <p className="text-gray-600">
              Get personalized menu recommendations and sales forecasting 
              powered by machine learning.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-lg">
            <div className="text-indigo-600 text-3xl mb-4">📈</div>
            <h3 className="text-xl font-semibold mb-2">Analytics & Reports</h3>
            <p className="text-gray-600">
              Comprehensive reporting dashboard with sales analytics, 
              performance metrics, and insights.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-gray-600 mb-8">
            Deploy your restaurant POS system in minutes with our cloud-ready solution.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/login"
              className="bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              Staff Login
            </Link>
            <Link
              href="/demo"
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              View Demo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
