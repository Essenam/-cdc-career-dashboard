import React from 'react';

function PlatformsHub({ setView }) {
  const platforms = [
    {
      name: 'Handshake',
      description: 'Job & internship discovery, employer connections, messaging',
      icon: '🎯',
      color: 'from-blue-500 to-blue-600',
      practice: 'Experiential Learning, Professional Networking',
      url: 'https://stthomas.joinhandshake.com',
      year: 'All years, especially Years 3-4'
    },
    {
      name: 'St. Thomas Connect',
      description: 'Alumni networking, mentorship, and informational interviews via PeopleGrove',
      icon: '🌐',
      color: 'from-purple-500 to-purple-600',
      practice: 'Alumni Engagement, Trusted Mentorship',
      url: 'https://stthomas.peoplegrove.com/hub/st-thomas-connect/home-v3',
      year: 'All years, especially Years 2-4'
    },
    {
      name: 'Big Interview',
      description: 'AI-powered interview practice with video coaching & feedback',
      icon: '🎬',
      color: 'from-orange-500 to-orange-600',
      practice: 'Skill Development',
      url: 'https://stthomas.biginterview.com',
      year: 'Years 3-4'
    },
    {
      name: 'Jobscan',
      description: 'Resume optimization, keyword matching, ATS checks',
      icon: '✨',
      color: 'from-green-500 to-green-600',
      practice: 'Skill Development, Informed Decision-Making',
      url: 'https://www.jobscan.co',
      year: 'Years 1-4'
    },
    {
      name: 'Labor Market Tool',
      description: 'Career research, salary data, job growth trends',
      icon: '📊',
      color: 'from-red-500 to-red-600',
      practice: 'Informed Decision-Making',
      url: 'https://www.mnprivatecolleges.org/member-resources/labor-market-tool',
      year: 'Years 2-3'
    },
    {
      name: 'PathwayU',
      description: 'Self-assessment, career exploration, major matching',
      icon: '🧭',
      color: 'from-indigo-500 to-indigo-600',
      practice: 'Informed Decision-Making, Skill Development',
      url: 'https://stthomas.pathwayu.com/login?next=%2Fjourney',
      year: 'Year 1 and ongoing'
    }
  ];

  const practices = [
    {
      name: 'Experiential Learning',
      description: 'Internships, research, and applied learning opportunities',
      icon: '🔬'
    },
    {
      name: 'Trusted Mentorship',
      description: 'Guidance from faculty, staff, and alumni advisors',
      icon: '👥'
    },
    {
      name: 'Informed Decision-Making',
      description: 'Access to resources that support career exploration',
      icon: '🎯'
    },
    {
      name: 'Alumni Engagement',
      description: 'Building connections with the global Tommie Network',
      icon: '🌐'
    },
    {
      name: 'Skill Development',
      description: 'Career competencies and continuous learning',
      icon: '📚'
    },
    {
      name: 'Professional Networking',
      description: 'Building meaningful relationships with peers and industry professionals',
      icon: '🤝'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <div className="border-b border-purple-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setView && setView('student')}
              className="text-purple-600 font-semibold hover:text-purple-800"
            >
              ← Back to Dashboard
            </button>
          </div>
          <h1 className="text-4xl font-bold text-purple-800 mb-2">Career Development Platforms</h1>
          <p className="text-gray-700">Access all tools and resources to accelerate your career readiness</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Main Platforms Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Your Platform Hub</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platforms.map((platform, idx) => (
              <a
                key={idx}
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`bg-gradient-to-br ${platform.color} rounded-xl p-8 text-white shadow-md hover:shadow-xl transition transform hover:scale-105 cursor-pointer block group`}
              >
                <p className="text-5xl mb-4 group-hover:scale-110 transition">{platform.icon}</p>
                <h3 className="font-bold text-xl mb-2">{platform.name}</h3>
                <p className="text-sm text-white text-opacity-90 mb-4">{platform.description}</p>

                <div className="border-t border-white border-opacity-20 pt-4 mt-4">
                  <p className="text-xs text-white text-opacity-75 font-semibold mb-2">
                    <span className="block">High-Impact Practices:</span>
                    {platform.practice}
                  </p>
                </div>

                <div className="mt-4 w-full bg-white text-gray-800 font-semibold py-2 rounded-lg text-sm text-center">
                  Launch Platform →
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* 6 High-Impact Practices */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Six High-Impact Career Practices</h2>
          <p className="text-gray-700 mb-8 max-w-2xl">
            The University of St. Thomas partners with the Career Leadership Collective to identify high-impact career practices that are highly correlated with higher career mobility. These six practices help students refine their career goals, target their job search, and become competitive applicants.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {practices.map((practice, idx) => (
              <div key={idx} className="bg-white border-2 border-purple-200 rounded-xl p-6 hover:shadow-lg transition">
                <p className="text-4xl mb-3">{practice.icon}</p>
                <h3 className="font-bold text-gray-900 mb-2">{practice.name}</h3>
                <p className="text-sm text-gray-600">{practice.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Reference */}
        <div className="bg-white border-2 border-purple-200 rounded-xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Reference Guide</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-purple-800 mb-4">Year 1: EXPLORE</h3>
              <p className="text-gray-700 text-sm mb-4">
                Campus Resources & Reflect : Use PathwayU, build your LinkedIn, explore with Jobscan, attend career fairs on Handshake
              </p>
            </div>
            <div>
              <h3 className="font-bold text-purple-800 mb-4">Year 2: RESEARCH</h3>
              <p className="text-gray-700 text-sm mb-4">
                Major & Career Possibilities : Research with Labor Market Tool, use St. Thomas Connect for mentors, network on Handshake
              </p>
            </div>
            <div>
              <h3 className="font-bold text-purple-800 mb-4">Year 3: DEVELOP</h3>
              <p className="text-gray-700 text-sm mb-4">
                Skills & Experiences : Apply on Handshake, practice with Big Interview, optimize resume with Jobscan, expand network
              </p>
            </div>
            <div>
              <h3 className="font-bold text-purple-800 mb-4">Year 4: IMPLEMENT</h3>
              <p className="text-gray-700 text-sm mb-4">
                Job Search Strategies : Search on Handshake, final interview prep with Big Interview, leverage alumni on St. Thomas Connect
              </p>
            </div>
          </div>
        </div>

        {/* CDC Support */}
        <div className="bg-gradient-to-r from-purple-700 to-purple-900 text-white rounded-xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-3">Need Help?</h3>
          <p className="text-purple-100 mb-6 max-w-2xl mx-auto">
            The Career Development Center team is here to support your journey. Connect with an advisor for personalized guidance on using these platforms and resources.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <a
              href="mailto:career@stthomas.edu"
              className="bg-white text-purple-900 font-bold px-6 py-3 rounded-lg hover:bg-purple-50 transition"
            >
              📧 Email CDC
            </a>
            <a
              href="https://stthomas.joinhandshake.com/appointments/new"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-white text-white font-bold px-6 py-3 rounded-lg hover:bg-white hover:text-purple-900 transition"
            >
              📞 Schedule Appointment
            </a>
            <a
              href="https://career.stthomas.edu/"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-white text-white font-bold px-6 py-3 rounded-lg hover:bg-white hover:text-purple-900 transition"
            >
              🌐 Visit career.stthomas.edu
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlatformsHub;
