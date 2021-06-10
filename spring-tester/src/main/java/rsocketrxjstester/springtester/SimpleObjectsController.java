package rsocketrxjstester.springtester;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import lombok.AllArgsConstructor;
import reactor.core.publisher.Mono;

/**
 * SimpleObjectsController
 */
@Controller
public class SimpleObjectsController {

    @MessageMapping("/encoding/request-response")
    public Mono<SimpleTestObject> jsonRequestResponse(SimpleTestObject obj) {
        return Mono.fromCallable(() -> {
            var returnObject = new SimpleTestObject(obj, obj.name, obj.age + 1, obj.greatness + 0.1);
            return returnObject;
        });
    }

    @AllArgsConstructor
    public static final class SimpleTestObject {

        public SimpleTestObject nested;

        public String name;
        public Integer age;
        public Double greatness;

    }

}