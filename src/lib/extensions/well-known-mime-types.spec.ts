import { WellKnownMimeTypes } from "./well-known-mime-types";



describe('WellKnownMimeTypes Extension', () => {


    it('Initializes on first call', () => {
        expect(WellKnownMimeTypes.getByIdentifer(WellKnownMimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION_V0.identifier).name).toEqual(WellKnownMimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION_V0.name);
    });
    it('Creates forward identifer map', () => {
        expect(WellKnownMimeTypes.getByIdentifer(WellKnownMimeTypes.MESSAGE_X_RSOCKET_ROUTING_V0.identifier).name).toEqual(WellKnownMimeTypes.MESSAGE_X_RSOCKET_ROUTING_V0.name);

    });
    it('Creates forward name map', () => {
        expect(WellKnownMimeTypes.getByName(WellKnownMimeTypes.MESSAGE_X_RSOCKET_ROUTING_V0.name).name).toEqual(WellKnownMimeTypes.MESSAGE_X_RSOCKET_ROUTING_V0.name);

    });

});