# opincode-shell-integration (zprofile)
#
# See zshenv.zsh for the rationale on the trailing `:`.
{
  _opincode_user_zdotdir="${OPINCODE_USER_ZDOTDIR:-$HOME}"
  [ -f "$_opincode_user_zdotdir/.zprofile" ] && source "$_opincode_user_zdotdir/.zprofile"
  unset _opincode_user_zdotdir
}
:
