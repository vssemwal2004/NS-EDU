// Site identity, temporary contact details, social profiles and footer copy/link groups.
export default {
  name: 'Gyaan Vidhya',
  tagline: 'Discover · Learn · Belong',
  // Temporary preview address: replace it and set contactIsTemporary to false when support is live.
  supportEmail: 'support@gyaanvidhya.example',
  contactIsTemporary: true,
  socials: [
    { name: 'Instagram', icon: 'instagram', href: null },
    { name: 'LinkedIn', icon: 'linkedin', href: null },
    { name: 'YouTube', icon: 'youtube', href: null },
    { name: 'Facebook', icon: 'facebook', href: null },
    { name: 'X', icon: 'socialX', href: null },
  ],
  footer: {
    eyebrow: 'YOUR NEXT CHAPTER',
    title: 'A clearer path to',
    titleAccent: 'your future.',
    lead: 'Explore your options. Understand the details. Choose with confidence.',
    intro: 'Thoughtful college choices begin with clear information. Find your course, compare your options and plan what comes next.',
    trust: 'Clear information. Thoughtful choices.',
    trustNote: 'Confirm admission requirements and fees with the institution before applying.',
    signature: 'Discover possibilities. Build your tomorrow.',
  },
  footerGroups: [
    { title: 'Explore', links: [
      { label: 'Colleges & universities', href: '/colleges' },
      { label: 'Courses & programmes', href: '/courses' },
      { label: 'Study by city', href: '/locations' },
      { label: 'Study by state', href: '/locations#study-states' },
      { label: 'Education news', href: '/news' },
      { label: 'Blog & student guides', href: '/blog' },
    ] },
    { title: 'Student tools', links: [
      { label: 'Compare colleges', href: '/compare' },
      { label: 'Check eligibility', href: '/eligibility' },
      { label: 'Plan your budget', href: '/budget' },
      { label: 'Scholarships & funding', href: '/scholarships' },
      { label: 'Career guidance', href: '/career-guidance' },
      { label: 'Admission checklist', href: '/admission-checklist' },
    ] },
    { title: 'Gyaan Vidhya & support', links: [
      { label: 'About Gyaan Vidhya', href: '/about' },
      { label: 'Contact & support', href: '/contact' },
      { label: 'Help centre & FAQs', href: '/help' },
      { label: 'Report a correction', href: '/report-correction' },
      { label: 'Sources & editorial approach', href: '/sources-and-editorial' },
      { label: 'Accessibility', href: '/accessibility' },
    ] },
    { title: 'Legal & privacy', links: [
      { label: 'Legal information', href: '/legal' },
      { label: 'Terms & conditions', href: '/terms-and-conditions' },
      { label: 'Privacy policy', href: '/privacy-policy' },
      { label: 'Cookies & browser storage', href: '/cookie-policy' },
      { label: 'Disclaimer', href: '/disclaimer' },
    ] },
  ],
};
