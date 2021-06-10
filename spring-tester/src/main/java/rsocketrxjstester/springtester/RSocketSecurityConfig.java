package rsocketrxjstester.springtester;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.rsocket.RSocketStrategies;
import org.springframework.messaging.rsocket.annotation.support.RSocketMessageHandler;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableReactiveMethodSecurity;
import org.springframework.security.config.annotation.rsocket.EnableRSocketSecurity;
import org.springframework.security.config.annotation.rsocket.RSocketSecurity;
import org.springframework.security.core.userdetails.MapReactiveUserDetailsService;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.messaging.handler.invocation.reactive.AuthenticationPrincipalArgumentResolver;
import org.springframework.security.rsocket.core.PayloadSocketAcceptorInterceptor;

@Configuration // (1)
@EnableRSocketSecurity // (2)
@EnableReactiveMethodSecurity // (3)
public class RSocketSecurityConfig {
    @Bean // (4)
    RSocketMessageHandler messageHandler(RSocketStrategies strategies) {

        RSocketMessageHandler handler = new RSocketMessageHandler();
        handler.getArgumentResolverConfigurer().addCustomResolver(new AuthenticationPrincipalArgumentResolver());
        handler.setRSocketStrategies(strategies);
        return handler;
    }

    @Bean // (5)
    MapReactiveUserDetailsService authentication() {
        // This is NOT intended for production use (it is intended for getting started
        // experience only)
        UserDetails user = User.withDefaultPasswordEncoder().username("user").password("pass").roles("USER").build();

        UserDetails admin = User.withDefaultPasswordEncoder().username("test").password("pass").roles("NONE").build();

        return new MapReactiveUserDetailsService(user, admin);
    }

    @Bean // (6)
    PayloadSocketAcceptorInterceptor authorization(RSocketSecurity security) {
        security.authorizePayload(authorize -> authorize.route("/basic/**").permitAll().anyExchange().permitAll() // all
        // connections,
        // exchanges.
        ).simpleAuthentication(Customizer.withDefaults());
        // security.authorizePayload(authorize ->
        // authorize.route("/error/*").permitAll() // all connections, exchanges.
        // ).simpleAuthentication(Customizer.withDefaults());
        return security.build();
    }
}
