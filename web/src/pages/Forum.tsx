import React from 'react';
import Layout from '@/components/Layout';
import { Plus, MessageSquare, Eye, TrendingUp, Search } from 'lucide-react';

const Forum: React.FC = () => {

  const topics = [
    { title: 'Proposal: New Treasury Spend for Marketing', user: 'Alice', avatar: '/avatars/avatar-1.png', category: 'Proposals', replies: 42, views: 1200, activity: '1h' },
    { title: 'Help with setting up a validator node', user: 'Bob', avatar: '/avatars/avatar-2.png', category: 'Technical Support', replies: 15, views: 850, activity: '3h' },
    { title: 'PezkuwiChain 2.0 Vision', user: 'Charlie', avatar: '/avatars/avatar-3.png', category: 'General Discussion', replies: 128, views: 5600, activity: '1d' },
    { title: 'Feature Request: Integrated NFT creator', user: 'David', avatar: '/avatars/avatar-4.png', category: 'Feature Requests', replies: 3, views: 250, activity: '2d' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 text-white">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Community Forum</h1>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" placeholder="Search forum..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors">
              <Plus className="mr-2" size={20} /> New Topic
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-700 font-bold text-gray-400">
            <div className="col-span-6">Topic</div>
            <div className="col-span-2 text-center">Category</div>
            <div className="col-span-1 text-center">Replies</div>
            <div className="col-span-1 text-center">Views</div>
            <div className="col-span-2 text-right">Activity</div>
          </div>
          
          {topics.map((topic, index) => (
            <div key={index} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-700 hover:bg-gray-700/50 transition-colors items-center">
              <div className="col-span-12 md:col-span-6">
                <a href="#" className="font-bold text-lg text-blue-400 hover:underline">{topic.title}</a>
                <div className="flex items-center mt-1 text-sm text-gray-400">
                  <img src={topic.avatar} alt={topic.user} className="w-6 h-6 rounded-full mr-2" />
                  <span>{topic.user}</span>
                </div>
              </div>
              <div className="col-span-6 md:col-span-2 text-left md:text-center">
                <span className="font-semibold text-sm" style={{color: '#'+(Math.random()*0xFFFFFF<<0).toString(16)}}>{topic.category}</span>
              </div>
              <div className="col-span-2 md:col-span-1 text-left md:text-center flex items-center justify-start md:justify-center">
                <MessageSquare size={16} className="mr-1 text-gray-500" /> {topic.replies}
              </div>
              <div className="col-span-2 md:col-span-1 text-left md:text-center flex items-center justify-start md:justify-center">
                 <Eye size={16} className="mr-1 text-gray-500" /> {topic.views}
              </div>
              <div className="col-span-4 md:col-span-2 text-left md:text-right text-gray-400">
                {topic.activity}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Forum;
