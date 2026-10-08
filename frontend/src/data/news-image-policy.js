// Keep the user's person-free cover preference. Review each exact photo URL
// before adding it; host validation alone cannot identify people in images.
export const newsImagePolicy = {
  mode: 'reviewed',
  reviewedUrls: [
    'https://etimg.etb2bimg.com/thumb/img-size-108414/134766315.cms',
    'https://etimg.etb2bimg.com/thumb/img-size-14738/134766198.cms',
    'https://etimg.etb2bimg.com/thumb/img-size-207852/134764718.cms',
  ],
};
