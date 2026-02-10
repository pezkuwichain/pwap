import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { FileText, Building2, Home, Bell, ChevronLeft, ChevronRight, Upload, User, Sun, ShieldCheck, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserRoleCategories } from '@pezkuwi/lib/tiki';

// LocalStorage key prefix for citizen profile data
const CITIZEN_PROFILE_KEY = 'citizen_profile_';

interface CitizenProfileData {
  fullName: string;
  fatherName: string;
  location: string;
  photoUrl: string | null;
}

// Mock announcements data
const announcements = [
  {
    id: 1,
    title: "Bijî Azadiya Kurdistanê! (Long Live Free Kurdistan!)",
    description: "Bi serkeftina sîstema me ya dijîtal, em gaveke din li pêşiya azadiya xwe datînin. (With the success of our digital system, we take another step towards our freedom.)",
    date: "2025-01-19"
  },
  {
    id: 2,
    title: "Daxuyaniya Nû ya Hikûmetê (New Government Announcement)",
    description: "Pergalên nû yên xizmetguzariya dijîtal ji bo hemû welatiyan aktîv bûn. (New digital service systems have been activated for all citizens.)",
    date: "2025-01-18"
  },
  {
    id: 3,
    title: "Civîna Giştî ya Welatiyên (Citizens General Assembly)",
    description: "Civîna mehane ya welatiyên di 25ê vê mehê de pêk tê. Beşdarî bibin! (Monthly citizens assembly takes place on the 25th of this month. Participate!)",
    date: "2025-01-17"
  }
];

export default function Citizens() {
  const { selectedAccount } = usePezkuwi();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { nftDetails, citizenNumber, loading } = useDashboard();
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showGovDialog, setShowGovDialog] = useState(false);
  const [showCitizensDialog, setShowCitizensDialog] = useState(false);
  const [citizenNumberInput, setCitizenNumberInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [dialogType, setDialogType] = useState<'gov' | 'citizens'>('gov');

  // Citizen profile from localStorage
  const [citizenProfile, setCitizenProfile] = useState<CitizenProfileData>({
    fullName: '',
    fatherName: '',
    location: '',
    photoUrl: null
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<CitizenProfileData>({
    fullName: '',
    fatherName: '',
    location: '',
    photoUrl: null
  });

  // Load citizen profile from localStorage on mount
  useEffect(() => {
    if (selectedAccount?.address) {
      const storageKey = CITIZEN_PROFILE_KEY + selectedAccount.address;
      const savedProfile = localStorage.getItem(storageKey);
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile) as CitizenProfileData;
          setCitizenProfile(parsed);
          setEditForm(parsed);
        } catch (e) {
          console.error('Error parsing saved profile:', e);
        }
      } else {
        // No saved profile - prompt user to fill in their info
        setShowEditModal(true);
      }
    }
  }, [selectedAccount?.address]);

  // Save citizen profile to localStorage
  const saveCitizenProfile = (data: CitizenProfileData) => {
    if (selectedAccount?.address) {
      const storageKey = CITIZEN_PROFILE_KEY + selectedAccount.address;
      localStorage.setItem(storageKey, JSON.stringify(data));
      setCitizenProfile(data);
      toast({
        title: "Profîl hat tomarkirin (Profile saved)",
        description: "Zanyariyên we bi serkeftî hatin tomarkirin (Your information has been saved successfully)"
      });
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) {
      return;
    }

    if (!selectedAccount?.address) {
      toast({
        title: "Cüzdan bağlı değil (Wallet not connected)",
        description: "Ji kerema xwe wallet-ê xwe girêbide (Please connect your wallet)",
        variant: "destructive"
      });
      return;
    }

    const file = event.target.files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Dosya hatası (File error)",
        description: "Lütfen resim dosyası yükleyin (Please upload an image file)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 2MB for localStorage)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Dosya çok büyük (File too large)",
        description: "Maksimum dosya boyutu 2MB (Maximum file size is 2MB)",
        variant: "destructive"
      });
      return;
    }

    setUploadingPhoto(true);

    try {
      // Convert file to base64 data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            resolve(reader.result as string);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(file);
      });

      // Save to localStorage with profile
      const updatedProfile = { ...citizenProfile, photoUrl: dataUrl };
      saveCitizenProfile(updatedProfile);

      toast({
        title: "Wêne hat barkirin (Photo uploaded)",
        description: "Wêneyê we bi serkeftî hat tomarkirin (Your photo has been saved successfully)"
      });
    } catch (error) {
      console.error('Photo upload error:', error);
      toast({
        title: "Xeletiya barkirinê (Upload error)",
        description: error instanceof Error ? error.message : "Wêne nehat barkirin (Could not upload photo)",
        variant: "destructive"
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Handle case where no wallet is connected
  if (!selectedAccount && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-700 via-white to-red-600 flex items-center justify-center">
        <Card className="bg-white/90 backdrop-blur max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-xl font-bold text-red-700">Ji kerema xwe re Wallet-ê xwe girêbide</p>
              <p className="text-lg text-gray-700">(Please connect your wallet)</p>
              <Button
                onClick={() => navigate('/')}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Home className="mr-2 h-4 w-4" />
                Vegere Malê (Back to Home)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCitizensIssue = () => {
    // Check if user has Tiki NFT
    if (!nftDetails.citizenNFT) {
      toast({
        title: "Mafê Te Tuneye (No Access)",
        description: "Divê hûn xwedîyê Tiki NFT bin ku vê rûpelê bigihînin (You must own a Tiki NFT to access this page)",
        variant: "destructive"
      });
      return;
    }

    // Show citizen number verification dialog for Citizens Issues
    setDialogType('citizens');
    setShowCitizensDialog(true);
  };

  const handleGovEntrance = () => {
    // Check if user has Tiki NFT
    if (!nftDetails.citizenNFT) {
      toast({
        title: "Mafê Te Tuneye (No Access)",
        description: "Divê hûn xwedîyê Tiki NFT bin ku vê rûpelê bigihînin (You must own a Tiki NFT to access this page)",
        variant: "destructive"
      });
      return;
    }

    // Navigate directly - GovernmentEntrance will handle verification
    navigate('/citizens/government');
  };

  const handleVerifyCitizenNumber = () => {
    setIsVerifying(true);

    // Construct the full citizen number format: #42-0-123456
    const actualCitizenNumber = nftDetails.citizenNFT
      ? `#${nftDetails.citizenNFT.collectionId}-${nftDetails.citizenNFT.itemId}-${citizenNumber}`
      : '';

    // Clean and compare
    const inputCleaned = citizenNumberInput.trim().toUpperCase();

    if (inputCleaned === actualCitizenNumber.toUpperCase()) {
      setShowGovDialog(false);
      setShowCitizensDialog(false);
      setCitizenNumberInput('');

      if (dialogType === 'gov') {
        toast({
          title: "✅ Girêdayî Destûrdar (Authentication Successful)",
          description: "Hûn dikarin dest bi hikûmetê bikin (You can now access government portal)",
        });
        navigate('/citizens/government');
      } else {
        toast({
          title: "✅ Girêdayî Destûrdar (Authentication Successful)",
          description: "Hûn dikarin dest bi karên welatiyên bikin (You can now access citizens issues)",
        });
        navigate('/citizens/issues');
      }
    } else {
      toast({
        title: "❌ Hejmara Welatî Şaş e (Wrong Citizen Number)",
        description: "Hejmara welatîbûna ku hûn nivîsandiye rast nine (The citizen number you entered is incorrect)",
        variant: "destructive"
      });
    }

    setIsVerifying(false);
  };

  const nextAnnouncement = () => {
    setCurrentAnnouncementIndex((prev) => (prev + 1) % announcements.length);
  };

  const prevAnnouncement = () => {
    setCurrentAnnouncementIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-700 via-white to-red-600 flex items-center justify-center">
        <Card className="bg-white/90 backdrop-blur">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <p className="text-gray-700 font-medium">Portala Welatiyên tê barkirin... (Loading Citizens Portal...)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get role categories for display
  const roleCategories = getUserRoleCategories(nftDetails.roleNFTs) || {
    government: [],
    citizen: [],
    business: [],
    judicial: []
  };
  if (import.meta.env.DEV) console.log('Role categories:', roleCategories);

  const currentAnnouncement = announcements[currentAnnouncementIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-700 via-white to-red-600">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            className="bg-red-600 hover:bg-red-700 border-yellow-400 border-2 text-white font-semibold shadow-lg"
          >
            <Home className="mr-2 h-4 w-4" />
            Vegere Malê (Back to Home)
          </Button>
        </div>

        {/* Title Section */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-bold text-red-700 mb-3 drop-shadow-lg">
            Portala Welatiyên (Citizen Portal)
          </h1>
          <p className="text-xl text-gray-800 font-semibold drop-shadow-md">
            Kurdistana Dijîtal (Digital Kurdistan)
          </p>
        </div>

        {/* Announcements Widget - Modern Carousel */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="relative bg-gradient-to-r from-red-600 via-red-500 to-yellow-500 rounded-3xl shadow-xl overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative p-8">
              <div className="flex items-center justify-between">
                <button
                  onClick={prevAnnouncement}
                  className="z-10 text-white/80 hover:text-white transition-all hover:scale-110"
                >
                  <ChevronLeft className="h-8 w-8" />
                </button>

                <div className="flex-1 text-center px-6">
                  <div className="flex items-center justify-center mb-3">
                    <Bell className="h-7 w-7 text-white mr-3 animate-pulse" />
                    <h3 className="text-3xl font-bold text-white">Daxuyanî</h3>
                  </div>
                  <h4 className="text-xl font-bold text-white mb-3">{currentAnnouncement.title}</h4>
                  <p className="text-white/90 text-base leading-relaxed max-w-2xl mx-auto">{currentAnnouncement.description}</p>
                  <p className="text-white/70 text-sm mt-3">{currentAnnouncement.date}</p>

                  {/* Modern dots indicator */}
                  <div className="flex justify-center gap-3 mt-5">
                    {announcements.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentAnnouncementIndex(idx)}
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          idx === currentAnnouncementIndex
                            ? 'bg-white w-8'
                            : 'bg-white/40 w-2.5 hover:bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={nextAnnouncement}
                  className="z-10 text-white/80 hover:text-white transition-all hover:scale-110"
                >
                  <ChevronRight className="h-8 w-8" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Entrance Cards - Grid with exactly 2 cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
          {/* LEFT: Citizens Issues */}
          <Card
            className="bg-white/95 backdrop-blur border-4 border-purple-400 hover:border-purple-600 transition-all shadow-2xl cursor-pointer group hover:scale-105"
            onClick={handleCitizensIssue}
          >
            <CardContent className="p-8 flex flex-col items-center justify-center min-h-[300px]">
              <div className="mb-6">
                <div className="bg-purple-500 w-24 h-24 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                  <FileText className="h-12 w-12 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-purple-700 mb-2 text-center">
                Karên Welatiyên
              </h2>
              <p className="text-lg text-gray-600 font-medium text-center">
                (Citizens Issues)
              </p>
            </CardContent>
          </Card>

          {/* RIGHT: Gov Entrance */}
          <Card
            className="bg-white/95 backdrop-blur border-4 border-green-400 hover:border-green-600 transition-all shadow-2xl cursor-pointer group hover:scale-105"
            onClick={handleGovEntrance}
          >
            <CardContent className="p-8 flex flex-col items-center justify-center min-h-[300px]">
              <div className="mb-6">
                <div className="bg-green-600 w-24 h-24 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                  <Building2 className="h-12 w-12 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-green-700 mb-2 text-center">
                Deriyê Hikûmetê
              </h2>
              <p className="text-lg text-gray-600 font-medium text-center">
                (Gov. Entrance)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Digital Citizen ID Card - Pure HTML/CSS Design */}
        <div className="max-w-2xl mx-auto">
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #166534 0%, #16a34a 15%, #ffffff 35%, #ffffff 65%, #dc2626 85%, #991b1b 100%)',
              aspectRatio: '1.586/1'
            }}
          >
            {/* Security Pattern Overlay */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 10px,
                  #000 10px,
                  #000 11px
                )`
              }}
            />

            {/* Top Header Band */}
            <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-green-800 via-green-700 to-green-800 py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Sun Symbol */}
                  <div className="relative">
                    <Sun className="h-8 w-8 text-yellow-400 drop-shadow-lg" />
                    <div className="absolute inset-0 animate-pulse">
                      <Sun className="h-8 w-8 text-yellow-300 opacity-50" />
                    </div>
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm tracking-wider">KOMARÎ KURDISTAN</div>
                    <div className="text-green-200 text-[10px] tracking-wide">REPUBLIC OF KURDISTAN</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-yellow-400 font-bold text-xs">NASNAMEYA DÎJÎTAL</div>
                  <div className="text-green-200 text-[10px]">DIGITAL IDENTITY CARD</div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="absolute top-16 bottom-10 left-0 right-0 px-5 flex">

              {/* Left Section - Photo */}
              <div className="w-1/4 flex flex-col items-center justify-center">
                <div className="relative w-full aspect-[3/4] max-w-[120px] group">
                  {/* Photo Frame */}
                  <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-red-600 rounded-lg p-[2px]">
                    <div className="w-full h-full bg-white rounded-lg overflow-hidden flex items-center justify-center">
                      {citizenProfile.photoUrl ? (
                        <img src={citizenProfile.photoUrl} alt="Citizen Photo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                          <User className="w-12 h-12 text-gray-300" />
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Upload Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="text-white text-xs px-2 py-1 h-auto hover:bg-white/20"
                    >
                      {uploadingPhoto ? (
                        <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent" />
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>
              </div>

              {/* Middle Section - Personal Info */}
              <div className="flex-1 px-4 flex flex-col justify-center space-y-3 relative">
                {/* Edit Button */}
                <button
                  onClick={() => {
                    setEditForm(citizenProfile);
                    setShowEditModal(true);
                  }}
                  className="absolute -top-2 right-0 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md transition-colors"
                  title="Biguherîne (Edit)"
                >
                  <Pencil className="h-3 w-3 text-gray-600" />
                </button>

                {/* Name */}
                <div className="bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 border-l-4 border-green-600 shadow-sm">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Nav / Name</div>
                  <div className="text-sm font-bold text-gray-800 truncate">{citizenProfile.fullName || 'Biguherîne...'}</div>
                </div>

                {/* Father's Name */}
                <div className="bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 border-l-4 border-yellow-500 shadow-sm">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Navê Bav / Father&apos;s Name</div>
                  <div className="text-sm font-bold text-gray-800 truncate">{citizenProfile.fatherName || 'Biguherîne...'}</div>
                </div>

                {/* Location */}
                <div className="bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 border-l-4 border-red-600 shadow-sm">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Cih / Location</div>
                  <div className="text-sm font-bold text-gray-800 truncate">{citizenProfile.location || 'Biguherîne...'}</div>
                </div>
              </div>

              {/* Right Section - NFT & ID Numbers */}
              <div className="w-1/4 flex flex-col justify-center items-center space-y-2">
                {/* NFT Badge */}
                <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-xl p-3 text-center shadow-lg w-full max-w-[110px]">
                  <div className="text-[9px] text-green-200 font-medium uppercase tracking-wider">NFT ID</div>
                  <div className="text-white font-bold text-sm mt-1">
                    {nftDetails.citizenNFT ? `#${nftDetails.citizenNFT.collectionId}-${nftDetails.citizenNFT.itemId}` : 'N/A'}
                  </div>
                </div>

                {/* Citizen Number Badge */}
                <div className="bg-gradient-to-br from-red-700 to-red-900 rounded-xl p-3 text-center shadow-lg w-full max-w-[110px]">
                  <div className="text-[9px] text-red-200 font-medium uppercase tracking-wider">Hejmara Welatî</div>
                  <div className="text-[8px] text-red-300 mb-1">Citizen No</div>
                  <div className="text-white font-bold text-[11px]">
                    {nftDetails.citizenNFT ? `#${nftDetails.citizenNFT.collectionId}-${nftDetails.citizenNFT.itemId}-${citizenNumber}` : 'N/A'}
                  </div>
                </div>

                {/* Verified Badge */}
                <div className="flex items-center gap-1 bg-white/90 rounded-full px-2 py-1 shadow">
                  <ShieldCheck className="h-3 w-3 text-green-600" />
                  <span className="text-[9px] font-semibold text-green-700">VERIFIED</span>
                </div>
              </div>
            </div>

            {/* Bottom Footer Band */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-red-800 via-red-700 to-red-800 py-2 px-4">
              <div className="flex items-center justify-between text-[9px]">
                <div className="text-red-200">
                  <span className="font-medium">Blockchain:</span> Pezkuwichain People
                </div>
                <div className="text-yellow-400 font-bold tracking-wider">
                  BIJÎ KURDISTAN
                </div>
                <div className="text-red-200">
                  <span className="font-medium">Type:</span> Welati NFT
                </div>
              </div>
            </div>

            {/* Corner Decorations */}
            <div className="absolute top-14 left-2 w-6 h-6 border-l-2 border-t-2 border-green-600/30 rounded-tl-lg" />
            <div className="absolute top-14 right-2 w-6 h-6 border-r-2 border-t-2 border-red-600/30 rounded-tr-lg" />
            <div className="absolute bottom-8 left-2 w-6 h-6 border-l-2 border-b-2 border-green-600/30 rounded-bl-lg" />
            <div className="absolute bottom-8 right-2 w-6 h-6 border-r-2 border-b-2 border-red-600/30 rounded-br-lg" />
          </div>
        </div>

      {/* Government Entrance - Citizen Number Verification Dialog */}
      <Dialog open={showGovDialog} onOpenChange={setShowGovDialog}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-green-700 via-white to-red-600">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-red-700">
              <div className="flex items-center justify-center mb-4">
                <Sun className="h-16 w-16 text-yellow-500 animate-spin" style={{ animationDuration: '8s' }} />
              </div>
              Deriyê Hikûmetê (Government Entrance)
            </DialogTitle>
            <DialogDescription className="text-center text-gray-700 font-medium">
              Ji kerema xwe hejmara welatîbûna xwe binivîse
              <br />
              <span className="text-sm italic">(Please enter your citizen number)</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800">
                Hejmara Welatîbûnê (Citizen Number)
              </label>
              <Input
                type="text"
                placeholder="#42-0-123456"
                value={citizenNumberInput}
                onChange={(e) => setCitizenNumberInput(e.target.value)}
                className="text-center font-mono text-lg border-2 border-green-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isVerifying) {
                    handleVerifyCitizenNumber();
                  }
                }}
              />
            </div>
            <Button
              onClick={handleVerifyCitizenNumber}
              disabled={isVerifying || !citizenNumberInput.trim()}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
            >
              <ShieldCheck className="mr-2 h-5 w-5" />
              {isVerifying ? 'Kontrolkirina... (Verifying...)' : 'Daxelbûn (Enter)'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Citizens Issues - Citizen Number Verification Dialog */}
      <Dialog open={showCitizensDialog} onOpenChange={setShowCitizensDialog}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-green-700 via-white to-red-600">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-purple-700">
              <div className="flex items-center justify-center mb-4">
                <Sun className="h-16 w-16 text-yellow-500 animate-spin" style={{ animationDuration: '8s' }} />
              </div>
              Karên Welatiyên (Citizens Issues)
            </DialogTitle>
            <DialogDescription className="text-center text-gray-700 font-medium">
              Ji kerema xwe hejmara welatîbûna xwe binivîse
              <br />
              <span className="text-sm italic">(Please enter your citizen number)</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800">
                Hejmara Welatîbûnê (Citizen Number)
              </label>
              <Input
                type="text"
                placeholder="#42-0-123456"
                value={citizenNumberInput}
                onChange={(e) => setCitizenNumberInput(e.target.value)}
                className="text-center font-mono text-lg border-2 border-purple-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isVerifying) {
                    handleVerifyCitizenNumber();
                  }
                }}
              />
            </div>
            <Button
              onClick={handleVerifyCitizenNumber}
              disabled={isVerifying || !citizenNumberInput.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
            >
              <ShieldCheck className="mr-2 h-5 w-5" />
              {isVerifying ? 'Kontrolkirina... (Verifying...)' : 'Daxelbûn (Enter)'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-gray-800">
              Zanyariyên Kesane Biguherîne
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600">
              Edit Your Personal Information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm font-medium">
                Nav / Name
              </Label>
              <Input
                id="edit-name"
                type="text"
                placeholder="Navê xwe binivîse..."
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                className="border-2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-father" className="text-sm font-medium">
                Navê Bav / Father&apos;s Name
              </Label>
              <Input
                id="edit-father"
                type="text"
                placeholder="Navê bavê xwe binivîse..."
                value={editForm.fatherName}
                onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })}
                className="border-2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-location" className="text-sm font-medium">
                Cih / Location
              </Label>
              <Input
                id="edit-location"
                type="text"
                placeholder="Cihê xwe binivîse..."
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                className="border-2"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="flex-1"
              >
                Betal (Cancel)
              </Button>
              <Button
                onClick={() => {
                  saveCitizenProfile(editForm);
                  setShowEditModal(false);
                }}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Tomar bike (Save)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
