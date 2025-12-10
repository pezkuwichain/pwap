import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { marked } from 'marked';
import { ChevronRight, Book, ExternalLink } from 'lucide-react';
import DOMPurify from 'dompurify';

// SDK Embedded View - shown inline in the content area (window in window style)
const SDKEmbeddedView: React.FC = () => {
    const sdkUrl = '/sdk_docs/pezkuwi_sdk_docs/index.html';

    return (
        <div className="flex flex-col h-full min-h-[600px]">
            {/* SDK Panel Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 rounded-t-lg border border-gray-700 border-b-0">
                <img
                    src="/pezkuwi_icon.png"
                    alt="Pezkuwi"
                    className="w-8 h-8 rounded"
                />
                <div>
                    <h3 className="text-white font-semibold">pezkuwi_sdk_docs</h3>
                    <span className="text-gray-400 text-xs">0.0.1</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <a
                        href={sdkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-gray-700 rounded-md transition-colors text-gray-400 hover:text-white"
                        title="Open in new tab"
                    >
                        <ExternalLink size={16} />
                    </a>
                </div>
            </div>
            {/* SDK Docs iframe */}
            <div className="flex-1 border border-gray-700 rounded-b-lg overflow-hidden bg-white">
                <iframe
                    src={sdkUrl}
                    title="Pezkuwi SDK Documentation"
                    className="w-full h-full border-0"
                    style={{ minHeight: '550px' }}
                />
            </div>
        </div>
    );
};

const SidebarNav: React.FC<{ structure: object, onLinkClick: () => void, onSDKClick: () => void }> = ({ structure, onLinkClick, onSDKClick }) => {
    const [openCategories, setOpenCategories] = useState<string[]>(['Getting Started', 'SDK Reference', 'General Docs', 'Contributor Guide']);

    const toggleCategory = (category: string) => {
        setOpenCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const renderNav = (struct: any) => {
        return Object.entries(struct).map(([key, value]) => {
            if (typeof value === 'string') {
                // Check if it's the SDK docs special link
                const isSDKLink = value === 'sdk://open';

                if (isSDKLink) {
                    return (
                        <li key={key}>
                            <button
                                onClick={() => {
                                    onSDKClick();
                                }}
                                className="w-full text-left block py-1 px-2 rounded-md hover:bg-gray-700 transition-colors font-bold text-green-400 hover:text-green-300 flex items-center gap-2"
                            >
                                {key}
                            </button>
                        </li>
                    );
                }

                const path = value.replace(/\.(md|rs)$/, '');
                return (
                    <li key={path}>
                        <Link
                            to={`/docs/${path}`}
                            onClick={onLinkClick}
                            className="block py-1 px-2 rounded-md hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
                        >
                            {key}
                        </Link>
                    </li>
                );
            } else {
                const isExpanded = openCategories.includes(key);
                return (
                    <li key={key}>
                        <div
                            onClick={() => toggleCategory(key)}
                            className="flex justify-between items-center cursor-pointer py-2 px-2 rounded-md hover:bg-gray-700"
                        >
                            <span className="font-semibold text-white">{key}</span>
                            <ChevronRight size={16} className={`transform transition-transform text-gray-400 ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                        {isExpanded && (
                            <ul className="pl-4 border-l border-gray-600 ml-2">
                                {renderNav(value)}
                            </ul>
                        )}
                    </li>
                );
            }
        });
    };

    return <nav><ul className="space-y-1">{renderNav(structure)}</ul></nav>;
};


const Docs: React.FC = () => {
    const { '*': splat } = useParams();
    const navigate = useNavigate();
    const [docStructure, setDocStructure] = useState<object | null>(null);
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showSDKLanding, setShowSDKLanding] = useState(false);

    // Fetch the documentation structure
    useEffect(() => {
        fetch('/docs-structure.json')
            .then(res => {
                if (!res.ok) {
                    throw new Error('Failed to load documentation structure.');
                }
                return res.json();
            })
            .then(data => setDocStructure(data))
            .catch(e => setError(e.message));
    }, []);

    const filePath = useMemo(() => {
        // If no splat, and the structure is loaded, default to the introduction markdown
        if (!splat && docStructure) {
            const defaultEntry = docStructure['Introduction'];
            if (typeof defaultEntry === 'string') {
                return defaultEntry;
            }
        } else if (splat) {
            // Check if it's an SDK link which is an HTML file
            if (splat.startsWith('sdk_docs/') && splat.endsWith('html')) {
                return splat; // Treat as direct path, no .md or .rs append
            }
            return `${splat}.md`; // For .md or .rs files
        }
        return null; // No file selected, no default provided yet
    }, [splat, docStructure]);
    
    // If no splat and no default, avoid fetching content
    const shouldFetchContent = !!filePath && !filePath.startsWith('sdk_docs/'); // Do not fetch content if it's an external SDK link

    useEffect(() => {
        if (!shouldFetchContent) {
            setContent(''); // Clear content if not fetching
            setError(null);
            setIsLoading(false);
            return;
        }

        const fetchContent = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`/docs/${filePath}`);
                if (!response.ok) {
                    throw new Error(`Documentation file not found: ${filePath}`);
                }
                let text = await response.text();
                
                // If the file is a Rust file, wrap it in a markdown code block
                if (filePath.endsWith('.rs')) {
                    text = '```rust\n' + text + '\n```';
                }
                
                const renderer = new marked.Renderer();
                renderer.image = (href, title, text) => {
                    try {
                        // The base URL for the markdown file itself
                        const base = new URL(`/docs/${filePath}`, window.location.origin);
                        // Resolve the image's relative path against the markdown file's path
                        const imageUrl = new URL(href, base);
                        // Return the final path part of the URL
                        return `<img src="${imageUrl.pathname}" alt="${text}" title="${title || ''}" />`;
                    } catch (e) {
                        console.error("Error processing image URL:", e);
                        // Fallback to the original href if URL construction fails
                        return `<img src="${href}" alt="${text}" title="${title || ''}" />`;
                    }
                };
                marked.setOptions({ renderer });

                const parsed = await marked.parse(text);
                const sanitized = DOMPurify.sanitize(parsed);
                setContent(sanitized);

            } catch (e: any) {
                setError(e.message);
                setContent('');
            } finally {
                setIsLoading(false);
            }
        };

        fetchContent();
    }, [filePath, shouldFetchContent]); // Dependency array
    
    // Check if we're on SDK route
    const isSDKRoute = splat === 'sdk';

    return (
        <Layout>
            <div className="flex h-full overflow-hidden">
                {/* Sidebar */}
                <aside
                    className={`fixed lg:static top-16 left-0 h-full lg:h-auto z-30 w-64 bg-gray-800 lg:bg-transparent lg:w-1/4 lg:pr-8 py-4 transition-transform transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
                >
                     <div className="px-4">
                        {docStructure ? (
                            <SidebarNav
                                structure={docStructure}
                                onLinkClick={() => {
                                    setIsSidebarOpen(false);
                                    setShowSDKLanding(false);  // Clear SDK landing when navigating to other docs
                                }}
                                onSDKClick={() => {
                                    setIsSidebarOpen(false);
                                    setShowSDKLanding(true);   // Show SDK landing
                                    setContent('');            // Clear any markdown content
                                    navigate('/docs/sdk');
                                }}
                            />
                        ) : (
                            <p className="text-gray-400">Loading navigation...</p>
                        )}
                    </div>
                </aside>

                {/* Mobile Sidebar Toggle */}
                <button
                    className="fixed bottom-4 right-4 lg:hidden w-12 h-12 bg-green-600 rounded-full z-40 flex items-center justify-center text-white shadow-lg"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                    <Book size={24} />
                </button>


                {/* Main Content */}
                <main className="w-full lg:w-3/4 lg:pl-8 flex flex-col">
                    <div className="prose prose-invert prose-headings:text-cyan-400 prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-code:text-yellow-400 prose-pre:bg-gray-800 prose-pre:p-4 prose-pre:rounded-md max-w-none flex-1 min-h-0">
                        {isLoading && <p className="text-gray-400">Loading...</p>}
                        {error && <p className="text-red-400">Error: {error}</p>}

                        {/* SDK Embedded View - window in window style */}
                        {(showSDKLanding || isSDKRoute) && (
                            <SDKEmbeddedView />
                        )}

                        {/* Regular Markdown Content */}
                        {!isLoading && !error && content && !showSDKLanding && !isSDKRoute && (
                             <div dangerouslySetInnerHTML={{ __html: content }} />
                        )}

                        {/* Default Welcome */}
                        {!isLoading && !error && !content && !splat && !showSDKLanding && (
                            <div className="text-center py-12">
                                <div className="mb-8">
                                    <div className="text-6xl mb-4">📖</div>
                                    <h1 className="text-3xl font-bold text-white mb-2">PezkuwiChain Documentation</h1>
                                    <p className="text-lg text-gray-400">Learn how to build on PezkuwiChain</p>
                                </div>
                                <p className="text-xl text-gray-400 mb-4">
                                    Select a document from the sidebar to get started.
                                </p>
                                <div className="flex flex-wrap gap-4 justify-center mt-8">
                                    <Link to="/docs/GENESIS_ENGINEERING_PLAN" className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors">
                                        📋 Introduction
                                    </Link>
                                    <Link
                                        to="/docs/sdk"
                                        onClick={() => setShowSDKLanding(true)}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                    >
                                        📚 SDK Docs
                                    </Link>
                                    <Link to="/docs/whitepaper/whitepaper" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                                        📄 Whitepaper
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </Layout>
    );
};

export default Docs;
