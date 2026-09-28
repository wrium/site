export const SiteFooter = {
    template: `<span>Wrium v{{ version }} · MIT License</span>`,
    setup(props) {
        return { version: props.version };
    }
};
